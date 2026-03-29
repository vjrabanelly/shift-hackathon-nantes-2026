"""
rAIdio Backend — FastAPI + WebSocket

Pipeline events are pushed to the frontend via WebSocket:
    {"stage": "stt", "status": "active"}
    {"stage": "stt", "status": "done", "duration_ms": 1200, "text": "..."}

Radio monitoring events pushed via /ws/radio:
    {"type": "transcript", "text": "...", "alerts": [...], "has_alert": true}
"""

import asyncio
import io
import re
import time
import wave
import struct
import psutil
import os
import threading
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pathlib import Path

from stt import transcribe
from llm import ask, warmup as llm_warmup
from rag import retrieve_context
from tts import synthesize
from radio_monitor import (
    FailoverCapture, TranscriptBuffer, pcm_to_wav,
    detect_keywords, classify_with_llm, is_hallucination,
    compute_rms, is_silence,
    SAMPLE_RATE, CHANNELS, BYTES_PER_SAMPLE, resolve_radio_source_mode,
)
from alert_sound import play_alert, warmup as alert_sound_warmup
from text_utils import strip_markdown
from memory import record_alert

NO_RESULT_RESPONSE = "Je n'ai pas de réponse à cette question. Pouvez-vous reformuler ?"

# ---- Radio monitoring config ----
RADIO_STREAM_URL = os.getenv(
    "RADIO_STREAM_URL",
    "http://icecast.radiofrance.fr/franceinfo-midfi.mp3",
)
RADIO_CHUNK_DURATION = int(os.getenv("RADIO_CHUNK_DURATION", "30"))
RADIO_OVERLAP = int(os.getenv("RADIO_OVERLAP", "5"))
RADIO_ENABLED = os.getenv("RADIO_ENABLED", "1") == "1"
RADIO_DEBUG = os.getenv("RADIO_DEBUG", "0") == "1"
RADIO_FALLBACK_INPUT_DEVICE = os.getenv("RADIO_FALLBACK_INPUT_DEVICE")
RADIO_SOURCE = resolve_radio_source_mode()

_process = psutil.Process(os.getpid())
_radio_clients: set[WebSocket] = set()
_interaction_lock = threading.Lock()
_interaction_count = 0


def _ts() -> str:
    """Timestamp HH:MM:SS.mmm for debug logs."""
    now = datetime.now()
    return now.strftime("%H:%M:%S.") + f"{now.microsecond // 1000:03d}"


def get_rss_mb() -> float:
    """Current process RSS in MB."""
    return _process.memory_info().rss / (1024 * 1024)


def _begin_live_interaction(source: str) -> None:
    global _interaction_count
    with _interaction_lock:
        _interaction_count += 1
        count = _interaction_count
    print(f"[INTERACTION] start {source} (count={count})")


def _end_live_interaction(source: str) -> None:
    global _interaction_count
    with _interaction_lock:
        _interaction_count = max(0, _interaction_count - 1)
        count = _interaction_count
    print(f"[INTERACTION] end {source} (count={count})")


def _live_interaction_active() -> bool:
    with _interaction_lock:
        return _interaction_count > 0


async def _wait_for_live_interaction_to_clear() -> None:
    announced = False
    while _live_interaction_active():
        if not announced:
            print("[RADIO STT] Pause: interaction live en cours, priorite au PTT")
            announced = True
        await asyncio.sleep(0.25)


# ---- Radio monitoring background task ----

async def broadcast_radio_event(event: dict):
    """Push event to all connected /ws/radio clients."""
    dead: set[WebSocket] = set()
    for client in _radio_clients:
        try:
            await client.send_json(event)
        except Exception:
            dead.add(client)
    _radio_clients.difference_update(dead)


RADIO_POST_TRIGGER_SECONDS = int(os.getenv("RADIO_POST_TRIGGER", "20"))
RADIO_PRE_BUFFER_SECONDS = int(os.getenv("RADIO_PRE_BUFFER", "20"))


# Max chunks in queue before dropping (avoid unbounded memory if STT is slow)
RADIO_QUEUE_MAX = int(os.getenv("RADIO_QUEUE_MAX", "5"))


async def radio_capture_task(pcm_queue: asyncio.Queue):
    """
    Background task: capture radio stream continuously, put PCM chunks in queue.

    Runs independently of STT — never blocks waiting for transcription.
    Handles reconnection and overlap between chunks.
    """
    capture = FailoverCapture(
        RADIO_STREAM_URL,
        fallback_input_device=RADIO_FALLBACK_INPUT_DEVICE,
        verbose=RADIO_DEBUG,
        mode=RADIO_SOURCE,
    )
    overlap_buffer = b""
    chunk_index = 0
    backoff = 2

    try:
        capture.start()
    except FileNotFoundError:
        print("[RADIO CAPTURE] ERREUR: source radio indisponible — monitoring desactive")
        return

    await asyncio.sleep(1)

    while True:
        try:
            if not capture.is_alive():
                print(f"[RADIO CAPTURE] Flux coupe, reconnexion dans {backoff}s...")
                capture.stop()
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)
                try:
                    capture.start()
                    await asyncio.sleep(1)
                except Exception as e:
                    print(f"[RADIO CAPTURE] Erreur reconnexion: {e}")
                continue

            # Lire le nouveau segment
            new_duration = (
                RADIO_CHUNK_DURATION - RADIO_OVERLAP
                if overlap_buffer
                else RADIO_CHUNK_DURATION
            )
            new_pcm = await asyncio.to_thread(capture.read_chunk, new_duration)

            if new_pcm is None:
                continue

            full_pcm = overlap_buffer + new_pcm
            overlap_bytes = int(RADIO_OVERLAP * SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE)
            overlap_buffer = (
                new_pcm[-overlap_bytes:]
                if len(new_pcm) >= overlap_bytes
                else new_pcm
            )

            # Reset backoff au succes
            backoff = 2

            # Debug: PCM stats
            rms = compute_rms(full_pcm)
            pcm_duration = len(full_pcm) / (SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE)
            if RADIO_DEBUG:
                qsize = pcm_queue.qsize()
                print(
                    f"[{_ts()} RADIO CAPTURE] chunk #{chunk_index} | "
                    f"PCM {len(full_pcm)} bytes ({pcm_duration:.1f}s) | "
                    f"RMS={rms:.0f} | silence={is_silence(full_pcm)} | "
                    f"queue={qsize}/{RADIO_QUEUE_MAX}"
                )

            # Skip si silence
            if is_silence(full_pcm):
                if RADIO_DEBUG:
                    print(f"[{_ts()} RADIO CAPTURE] chunk #{chunk_index} -> silence, skip")
                chunk_index += 1
                continue

            # Convertir PCM → WAV maintenant (leger, evite de garder le gros PCM en queue)
            wav_bytes = pcm_to_wav(full_pcm)

            # Drop le plus vieux chunk si la queue est pleine (STT trop lent)
            if pcm_queue.full():
                try:
                    dropped = pcm_queue.get_nowait()
                    print(
                        f"[{_ts()} RADIO CAPTURE] queue pleine, "
                        f"drop chunk #{dropped['chunk_index']} pour faire place"
                    )
                except asyncio.QueueEmpty:
                    pass

            await pcm_queue.put({
                "chunk_index": chunk_index,
                "wav_bytes": wav_bytes,
                "pcm_duration": pcm_duration,
                "rms": rms,
                "captured_at": time.time(),
            })
            chunk_index += 1

        except Exception as e:
            print(f"[RADIO CAPTURE] Erreur inattendue: {e}")
            await asyncio.sleep(5)


async def radio_process_task(pcm_queue: asyncio.Queue):
    """
    Background task: consume PCM chunks from queue, run STT + keyword detect + LLM.

    Runs concurrently with radio_capture_task — capture continues while we transcribe.
    """
    # Buffer glissant : garde les derniers ~20s de transcript
    transcript_buf = TranscriptBuffer(max_age_seconds=RADIO_PRE_BUFFER_SECONDS)

    # State machine pour le trigger
    trigger_state: dict | None = None  # None = IDLE
    # Quand triggered: {"time": float, "keywords": [...], "pre_text": str}

    while True:
        try:
            await _wait_for_live_interaction_to_clear()
            chunk = await pcm_queue.get()
            chunk_index = chunk["chunk_index"]
            wav_bytes = chunk["wav_bytes"]
            pcm_duration = chunk["pcm_duration"]
            capture_lag = time.time() - chunk["captured_at"]

            if RADIO_DEBUG:
                state_label = "TRIGGERED" if trigger_state else "IDLE"
                print(
                    f"[{_ts()} RADIO STT] chunk #{chunk_index} [{state_label}] | "
                    f"lag={capture_lag:.1f}s | queue={pcm_queue.qsize()}"
                )

            await _wait_for_live_interaction_to_clear()
            # WAV → STT
            stt_result = await asyncio.to_thread(transcribe, wav_bytes)
            text = stt_result.get("text", "")
            stt_ms = stt_result.get("duration_ms", 0)
            stt_rtf = (stt_ms / 1000.0) / pcm_duration if pcm_duration > 0 else 0.0

            print(
                f"[{_ts()} RADIO STT] chunk #{chunk_index} | "
                f"audio={pcm_duration:.1f}s | STT={stt_ms}ms | RTF={stt_rtf:.2f}"
            )

            if RADIO_DEBUG:
                print(
                    f"[{_ts()} RADIO STT] chunk #{chunk_index} | "
                    f"texte ({len(text)} chars):"
                )
                print(f"  \"{text.strip()}\"")

            if is_hallucination(text):
                if RADIO_DEBUG:
                    print(f"[{_ts()} RADIO STT] chunk #{chunk_index} -> hallucination filtree")
                continue

            # Ajouter au buffer glissant
            now_ts = time.time()
            transcript_buf.add(text, now_ts)

            # ── State machine ────────────────────────────────────────

            if trigger_state is None:
                # IDLE : chercher un keyword trigger dans le texte frais
                matches = detect_keywords(text)

                if matches:
                    kw_list = sorted(set(m["keyword"] for m in matches))
                    print(
                        f"[RADIO] TRIGGER ({', '.join(kw_list)}) — "
                        f"accumulation {RADIO_POST_TRIGGER_SECONDS}s de contexte..."
                    )

                    if RADIO_DEBUG:
                        for m in matches:
                            print(
                                f"[{_ts()} RADIO STT] MATCH "
                                f"\"{m['keyword']}\" @ pos {m.get('position', '?')} | "
                                f"ctx: \"{m.get('context', '')[:80]}\""
                            )

                    trigger_state = {
                        "time": now_ts,
                        "keywords": matches,
                        "pre_text": transcript_buf.get_text(),
                    }
                elif RADIO_DEBUG:
                    print(f"[{_ts()} RADIO STT] chunk #{chunk_index} -> aucun keyword match")

            else:
                # TRIGGERED : accumuler du contexte post-trigger
                elapsed = now_ts - trigger_state["time"]

                if RADIO_DEBUG:
                    remaining = max(0, RADIO_POST_TRIGGER_SECONDS - elapsed)
                    print(
                        f"[{_ts()} RADIO STT] chunk #{chunk_index} -> "
                        f"post-trigger {elapsed:.0f}s / {RADIO_POST_TRIGGER_SECONDS}s "
                        f"({remaining:.0f}s restantes)"
                    )

                if elapsed >= RADIO_POST_TRIGGER_SECONDS:
                    # Assez de contexte — lancer l'analyse LLM
                    pre_text = trigger_state["pre_text"]
                    post_text = transcript_buf.get_text_since(trigger_state["time"])
                    full_context = (pre_text + " " + post_text).strip()
                    kw_matches = trigger_state["keywords"]
                    kw_list = sorted(set(m["keyword"] for m in kw_matches))

                    print(
                        f"[RADIO] Analyse LLM de {len(full_context)} chars "
                        f"(keywords: {', '.join(kw_list)})..."
                    )

                    if RADIO_DEBUG:
                        print(f"[{_ts()} RADIO STT] Contexte complet pour LLM:")
                        print(f"  \"{full_context}\"")

                    await _wait_for_live_interaction_to_clear()
                    # Appel LLM (bloquant → thread)
                    llm_result = await asyncio.to_thread(
                        classify_with_llm, full_context
                    )

                    if llm_result and llm_result.get("is_alert"):
                        severity = llm_result.get("severity", "warning")
                        summary = llm_result.get("summary", "")
                        alert_type = llm_result.get("type", "autre")
                        llm_ms = llm_result.get("llm_duration_ms", 0)

                        print(
                            f"[RADIO] ALERTE CONFIRMEE {severity.upper()} "
                            f"[{alert_type}] — {summary} "
                            f"(LLM {llm_ms}ms)"
                        )

                        # Broadcast l'alerte
                        alert_event: dict = {
                            "type": "alert",
                            "chunk_index": chunk_index,
                            "text": full_context,
                            "timestamp": datetime.now().isoformat(),
                            "has_alert": True,
                            "max_severity": severity,
                            "alert_keywords": kw_list,
                            "triggers": [
                                {
                                    "keyword": m["keyword"],
                                    "context": m.get("context", ""),
                                }
                                for m in kw_matches
                            ],
                            "llm_classification": {
                                "severity": severity,
                                "type": alert_type,
                                "summary": summary,
                            },
                        }
                        await broadcast_radio_event(alert_event)

                        # Jouer le son d'alerte sur le speaker systeme
                        play_alert(severity)

                        # Enregistrer dans la memoire situationnelle
                        await asyncio.to_thread(record_alert, alert_event)
                    else:
                        reason = (
                            llm_result.get("summary", "rejet LLM")
                            if llm_result
                            else "erreur LLM"
                        )
                        print(
                            f"[RADIO] Faux positif — {reason} "
                            f"(keywords: {', '.join(kw_list)})"
                        )
                        if RADIO_DEBUG and llm_result:
                            print(f"[{_ts()} RADIO STT] LLM result: {llm_result}")

                    # Reset state → IDLE
                    trigger_state = None

        except Exception as e:
            print(f"[RADIO STT] Erreur inattendue: {e}")
            await asyncio.sleep(1)


async def radio_monitor_task():
    """
    Lance les deux taches paralleles du monitoring radio :
      - capture : lit le flux audio en continu (jamais bloquee par le STT)
      - process : transcrit + detecte les alertes (consomme la queue)

    La queue entre les deux garantit que la capture ne s'arrete jamais,
    meme si le STT ou le LLM prend du temps.
    """
    if not RADIO_ENABLED:
        print("[RADIO] Monitoring desactive (RADIO_ENABLED=0)")
        return
    if RADIO_SOURCE == "off":
        print("[RADIO] Monitoring desactive (RADIO_SOURCE=off or USE_WEB_RADIO=0 without fallback)")
        return

    print(f"[RADIO] Demarrage monitoring : {RADIO_STREAM_URL}")
    print(f"[RADIO] Source mode      : {RADIO_SOURCE}")
    if RADIO_FALLBACK_INPUT_DEVICE:
        print(f"[RADIO] Fallback line-in : {RADIO_FALLBACK_INPUT_DEVICE}")
    print(f"[RADIO] Chunk={RADIO_CHUNK_DURATION}s, overlap={RADIO_OVERLAP}s, "
          f"queue_max={RADIO_QUEUE_MAX}")
    print(f"[RADIO] Buffer pre-trigger={RADIO_PRE_BUFFER_SECONDS}s, "
          f"post-trigger={RADIO_POST_TRIGGER_SECONDS}s")
    if RADIO_DEBUG:
        print("[RADIO] Mode DEBUG actif (RADIO_DEBUG=1)")

    # Attendre un peu pour laisser le serveur demarrer
    await asyncio.sleep(3)

    pcm_queue: asyncio.Queue = asyncio.Queue(maxsize=RADIO_QUEUE_MAX)

    # Lancer les deux taches en parallele
    await asyncio.gather(
        radio_capture_task(pcm_queue),
        radio_process_task(pcm_queue),
    )


@asynccontextmanager
async def lifespan(_app):
    # Startup: preload LLM + alert sounds in background
    asyncio.create_task(asyncio.to_thread(llm_warmup))
    asyncio.create_task(asyncio.to_thread(alert_sound_warmup))
    # Start radio monitoring
    asyncio.create_task(radio_monitor_task())
    yield


app = FastAPI(title="rAIdio", lifespan=lifespan)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


# ---- WebSocket pipeline ----

async def send_event(ws: WebSocket, stage: str, status: str, **kwargs):
    """Push a pipeline event to the frontend."""
    event = {"stage": stage, "status": status, **kwargs}
    await ws.send_json(event)


def convert_webm_to_wav(audio_bytes: bytes) -> bytes:
    """
    Convert raw float32 PCM samples (from browser AudioWorklet) to WAV.
    If already WAV (starts with RIFF), return as-is.
    """
    if audio_bytes[:4] == b'RIFF':
        return audio_bytes
    # Assume raw float32 PCM at 16kHz mono from the frontend
    # Convert float32 -> int16 WAV
    n_samples = len(audio_bytes) // 4
    float_samples = struct.unpack(f'<{n_samples}f', audio_bytes)
    int_samples = [max(-32768, min(32767, int(s * 32767))) for s in float_samples]

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(struct.pack(f'<{len(int_samples)}h', *int_samples))
    return buf.getvalue()


@app.websocket("/ws/pipeline")
async def websocket_pipeline(ws: WebSocket):
    await ws.accept()
    print("[WS] Client connected")

    try:
        while True:
            # Receive audio bytes from frontend
            audio_bytes = await ws.receive_bytes()
            print(f"[WS] Received {len(audio_bytes)} bytes of audio")
            _begin_live_interaction("ws/pipeline")
            current_stage = "stt"

            try:
                # --- STT stage ---
                await send_event(ws, "stt", "active")

                wav_bytes = convert_webm_to_wav(audio_bytes)
                rss_before = get_rss_mb()
                result = await asyncio.to_thread(transcribe, wav_bytes)
                rss_after = get_rss_mb()
                await send_event(
                    ws, "stt", "done",
                    duration_ms=result["duration_ms"],
                    text=result["text"],
                    ram_mb=round(rss_after, 1),
                    ram_delta_mb=round(rss_after - rss_before, 1),
                )

                # --- RAG stage ---
                current_stage = "rag"
                await send_event(ws, "rag", "active")

                t_rag = time.time()
                rag_result = await asyncio.to_thread(retrieve_context, result["text"])
                rag_ms = int((time.time() - t_rag) * 1000)
                has_context = bool(rag_result["prompt_context"].strip())
                await send_event(
                    ws, "rag", "done",
                    duration_ms=rag_ms,
                )

                # --- LLM stage (skipped if no RAG results) ---
                if has_context:
                    current_stage = "llm"
                    await send_event(ws, "llm", "active")
                    rss_before = get_rss_mb()
                    llm_result = await asyncio.to_thread(
                        ask, result["text"], rag_result["prompt_context"]
                    )
                    rss_after = get_rss_mb()
                    await send_event(
                        ws, "llm", "done",
                        duration_ms=llm_result["duration_ms"],
                        text=llm_result["text"],
                        ram_mb=round(rss_after, 1),
                        ram_delta_mb=round(rss_after - rss_before, 1),
                    )
                    tts_text = strip_markdown(llm_result["text"])
                else:
                    print(f"[LLM] Skipped — no RAG results, sending generic response")
                    await send_event(
                        ws, "llm", "done",
                        duration_ms=0,
                        text=NO_RESULT_RESPONSE,
                    )
                    tts_text = NO_RESULT_RESPONSE

                # --- TTS stage ---
                current_stage = "tts"
                await send_event(ws, "tts", "active")

                rss_before = get_rss_mb()
                tts_result = await asyncio.to_thread(synthesize, tts_text)
                rss_after = get_rss_mb()
                await send_event(
                    ws, "tts", "done",
                    duration_ms=tts_result["duration_ms"],
                    ram_mb=round(rss_after, 1),
                    ram_delta_mb=round(rss_after - rss_before, 1),
                )
            except Exception as e:
                print(f"[WS] Pipeline error: {e}")
                await send_event(ws, current_stage, "error", error=str(e))
                continue
            finally:
                _end_live_interaction("ws/pipeline")

            # --- Speaker stage: send WAV binary to frontend for playback ---
            await send_event(ws, "speaker", "active")
            await ws.send_bytes(tts_result["audio_bytes"])

    except WebSocketDisconnect:
        print("[WS] Client disconnected")


# ---- Radio monitoring WebSocket ----

@app.websocket("/ws/radio")
async def websocket_radio(ws: WebSocket):
    """WebSocket pour recevoir les transcriptions radio et alertes en temps reel."""
    await ws.accept()
    _radio_clients.add(ws)
    print(f"[WS/RADIO] Client connecte ({len(_radio_clients)} total)")
    try:
        while True:
            # Keep-alive: le client peut envoyer des pings
            await ws.receive_text()
    except WebSocketDisconnect:
        _radio_clients.discard(ws)
        print(f"[WS/RADIO] Client deconnecte ({len(_radio_clients)} total)")


NO_ALERT_RESPONSE = "Aucune alerte en memoire. La situation est calme."


# ---- Recall endpoint ----

@app.post("/api/recall")
async def recall_alerts():
    """
    Rappel vocal des alertes radio.

    Lit SITUATION.txt, le passe au TTS et renvoie le WAV.
    Utilise par pi_mouse_ptt.py sur double-clic.
    """
    from memory import read_memory

    memory_text = read_memory()
    if not memory_text:
        memory_text = NO_ALERT_RESPONSE

    print(f"[RECALL] TTS sur {len(memory_text)} chars de memoire situationnelle")

    try:
        tts_result = await asyncio.to_thread(synthesize, memory_text)
    except Exception as e:
        print(f"[RECALL] Erreur TTS: {e}")
        return Response(
            content=f"Erreur TTS: {e}",
            status_code=500,
            media_type="text/plain",
        )

    return Response(
        content=tts_result["audio_bytes"],
        media_type="audio/wav",
        headers={
            "X-Duration-Ms": str(tts_result["duration_ms"]),
            "X-Text-Length": str(len(memory_text)),
        },
    )


@app.post("/api/interaction/{state}")
async def set_interaction_state(state: str):
    if state == "start":
        _begin_live_interaction("pi_mouse_ptt")
        return {"status": "ok", "active": True}
    if state == "end":
        _end_live_interaction("pi_mouse_ptt")
        return {"status": "ok", "active": _live_interaction_active()}
    return Response(
        content="state must be start or end",
        status_code=400,
        media_type="text/plain",
    )


# ---- Static files (frontend) ----

@app.get("/")
async def root():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


if __name__ == "__main__":
    import argparse as _ap
    import uvicorn

    _parser = _ap.ArgumentParser(description="rAIdio Backend")
    _parser.add_argument("--debug", action="store_true", help="Active le mode debug radio (logs detailles)")
    _parser.add_argument("--no-radio-capture", action="store_true", help="Desactive la capture radio (monitoring, alertes)")
    _parser.add_argument("--host", default="0.0.0.0", help="Host (defaut: 0.0.0.0)")
    _parser.add_argument("--port", type=int, default=8000, help="Port (defaut: 8000)")
    _args = _parser.parse_args()

    if _args.debug:
        RADIO_DEBUG = True
    if _args.no_radio_capture:
        RADIO_ENABLED = False

    uvicorn.run(app, host=_args.host, port=_args.port)
