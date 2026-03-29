"""
rAIdio — Demo Pilot Backend

Serveur FastAPI separé pour piloter la demo en presentation.
Tourne sur le port 8001 (independant du backend principal sur 8000).

Fonctionnalites :
  - Jouer les sons d'alerte (critical / warning) sur le speaker du Pi
  - Lister et streamer les fichiers audio du dossier demo/sounds/
  - WebSocket pour synchronisation temps reel avec la SPA de pilotage

Usage:
  cd backend && uv run python demo.py
  cd backend && uv run python demo.py --port 8002
"""

import asyncio
import os
import subprocess
import threading
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response, JSONResponse

from alert_sound import (
    generate_critical_sound,
    generate_warning_sound,
    play_alert,
    warmup as alert_warmup,
)

# ---- Paths ----
ROOT_DIR = Path(__file__).parent.parent
DEMO_DIR = ROOT_DIR / "demo" / "sounds"
FRONTEND_DIR = ROOT_DIR / "frontend"

# Audio file extensions to list
AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".flac"}

# Connected WebSocket clients
_ws_clients: set[WebSocket] = set()

# Track currently playing subprocess
_playing_lock = threading.Lock()
_current_proc: subprocess.Popen | None = None
ALSA_OUTPUT_DEVICE = os.getenv("RAIDIO_ALSA_OUTPUT", "plughw:USB,0")


@asynccontextmanager
async def lifespan(_app):
    # Pre-generate alert sounds
    alert_warmup()
    print("[DEMO] Serveur de pilotage pret")
    print(f"[DEMO] Dossier sons: {DEMO_DIR}")
    print(f"[DEMO] Sortie ALSA: {ALSA_OUTPUT_DEVICE}")
    yield


app = FastAPI(title="rAIdio Demo Pilot", lifespan=lifespan)


# ---- Helpers ----

async def broadcast(event: dict):
    """Push event to all connected WS clients."""
    dead: set[WebSocket] = set()
    for client in _ws_clients:
        try:
            await client.send_json(event)
        except Exception:
            dead.add(client)
    _ws_clients.difference_update(dead)


def _play_wav_on_speaker(wav_bytes: bytes, label: str = ""):
    """Play WAV bytes via aplay (ALSA) — blocking, meant for thread."""
    global _current_proc
    proc = None
    try:
        proc = subprocess.Popen(
            ["aplay", "-q", "-D", ALSA_OUTPUT_DEVICE, "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _current_proc = proc
        proc.communicate(input=wav_bytes, timeout=120)
    except FileNotFoundError:
        print(f"[DEMO] aplay introuvable — lecture desactivee ({label})")
    except subprocess.TimeoutExpired:
        if proc:
            proc.kill()
    except Exception as e:
        print(f"[DEMO] Erreur lecture {label}: {e}")
    finally:
        _current_proc = None


def _play_file_on_speaker(filepath: Path):
    """Play an audio file on the configured ALSA output — blocking, meant for thread."""
    global _current_proc
    proc = None
    try:
        if filepath.suffix == ".wav":
            with open(filepath, "rb") as f:
                _play_wav_on_speaker(f.read(), filepath.name)
        else:
            proc = subprocess.Popen(
                [
                    "ffmpeg",
                    "-nostdin",
                    "-loglevel",
                    "quiet",
                    "-i",
                    str(filepath),
                    "-f",
                    "wav",
                    "-",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            _current_proc = proc
            wav_bytes, _ = proc.communicate(timeout=300)
            if proc.returncode != 0:
                raise RuntimeError(f"ffmpeg failed with code {proc.returncode}")
            _play_wav_on_speaker(wav_bytes, filepath.name)
    except FileNotFoundError:
        print(f"[DEMO] Outil audio introuvable — impossible de lire {filepath.name}")
    except subprocess.TimeoutExpired:
        if proc:
            proc.kill()
    except Exception as e:
        print(f"[DEMO] Erreur lecture {filepath.name}: {e}")
    finally:
        _current_proc = None


# ---- API Endpoints ----

@app.get("/api/sounds")
async def list_sounds():
    """Liste les fichiers audio disponibles dans demo/sounds/."""
    if not DEMO_DIR.exists():
        return JSONResponse({"sounds": []})

    sounds = []
    for f in sorted(DEMO_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() in AUDIO_EXTENSIONS:
            size_kb = f.stat().st_size / 1024
            sounds.append({
                "filename": f.name,
                "size_kb": round(size_kb, 1),
                "extension": f.suffix.lower(),
            })
    return JSONResponse({"sounds": sounds})


@app.get("/api/sounds/{filename}")
async def get_sound(filename: str):
    """Sert un fichier audio du dossier demo/sounds/."""
    if "/" in filename or "\\" in filename or ".." in filename:
        return Response(status_code=403, content="Acces interdit")
    filepath = DEMO_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        return Response(status_code=404, content="Fichier introuvable")

    media_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(filepath.suffix.lower(), "application/octet-stream")
    return FileResponse(filepath, media_type=media_type)


@app.post("/api/alert/{severity}")
async def trigger_alert(severity: str):
    """
    Joue un son d'alerte sur le speaker du Pi ET renvoie le WAV au navigateur.
    severity: 'critical' ou 'warning'
    """
    if severity not in ("critical", "warning"):
        return JSONResponse({"error": "severity must be 'critical' or 'warning'"}, status_code=400)

    # Generate WAV
    wav_bytes = generate_critical_sound() if severity == "critical" else generate_warning_sound()

    # Play on Pi speaker (non-blocking)
    play_alert(severity)

    # Broadcast event to WS clients
    await broadcast({"type": "alert", "severity": severity})

    print(f"[DEMO] Alerte {severity} declenchee")

    # Return WAV for browser playback too
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"X-Alert-Severity": severity},
    )


@app.post("/api/play/{filename}")
async def play_on_speaker(filename: str):
    """Joue un fichier audio sur le speaker du Pi (via aplay/ffplay)."""
    if "/" in filename or "\\" in filename or ".." in filename:
        return JSONResponse({"error": "Acces interdit"}, status_code=403)
    filepath = DEMO_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        return JSONResponse({"error": "Fichier introuvable"}, status_code=404)

    # Play in background thread
    await broadcast({"type": "playing", "filename": filename})
    asyncio.get_event_loop().run_in_executor(None, _play_file_on_speaker, filepath)

    print(f"[DEMO] Lecture sur speaker: {filename}")
    return JSONResponse({"status": "playing", "filename": filename})


@app.post("/api/stop")
async def stop_playback():
    """Arrete la lecture en cours sur le speaker."""
    global _current_proc
    if _current_proc and _current_proc.poll() is None:
        _current_proc.kill()
        _current_proc = None
        await broadcast({"type": "stopped"})
        print("[DEMO] Lecture arretee")
        return JSONResponse({"status": "stopped"})
    return JSONResponse({"status": "nothing_playing"})


# ---- WebSocket ----

@app.websocket("/ws")
async def websocket_demo(ws: WebSocket):
    """WebSocket pour synchronisation temps reel."""
    await ws.accept()
    _ws_clients.add(ws)
    print(f"[DEMO WS] Client connecte ({len(_ws_clients)} total)")
    try:
        while True:
            data = await ws.receive_text()
            # Client can send commands via WS too
            if data == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        _ws_clients.discard(ws)
        print(f"[DEMO WS] Client deconnecte ({len(_ws_clients)} total)")


# ---- Static files ----

@app.get("/")
async def root():
    return FileResponse(FRONTEND_DIR / "demo.html")


# ---- Main ----

if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="rAIdio Demo Pilot")
    parser.add_argument("--host", default="0.0.0.0", help="Host (defaut: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8001, help="Port (defaut: 8001)")
    args = parser.parse_args()

    print("=" * 50)
    print("  rAIdio — Demo Pilot")
    print(f"  http://{args.host}:{args.port}")
    print("=" * 50)

    uvicorn.run(app, host=args.host, port=args.port)
