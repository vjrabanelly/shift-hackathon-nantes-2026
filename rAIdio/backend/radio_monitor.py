#!/usr/bin/env python3
"""
rAIdio — Monitoring radio web en continu

Capture un flux webradio (ex: France Info), transcrit l'audio en temps reel
avec Whisper, et detecte les alertes d'urgence par keyword matching
(+ classification LLM optionnelle).

Usage:
    uv run python radio_monitor.py                          # France Info par defaut
    uv run python radio_monitor.py --url <URL>              # flux custom
    uv run python radio_monitor.py --use-llm                # + classification LLM
    uv run python radio_monitor.py --log-file alerts.jsonl  # log JSONL
    uv run python radio_monitor.py --chunk-duration 20      # chunks de 20s
"""

import argparse
import io
import json
import math  # noqa: F401 — utilise dans compute_rms
import os
import queue
import signal
import struct  # noqa: F401 — utilise dans compute_rms
import subprocess
import sys
import time
import unicodedata
import wave
from datetime import datetime

import sounddevice as sd

from stt import transcribe
from keywords import ALERT_KEYWORDS, ALERT_CLASSIFICATION_PROMPT  # noqa: F401

# ── Config ────────────────────────────────────────────────────────────────────

SAMPLE_RATE = 16000
CHANNELS = 1
BYTES_PER_SAMPLE = 2  # s16le = 2 bytes

DEFAULT_STREAM_URL = "http://icecast.radiofrance.fr/franceinfo-midfi.mp3"
DEFAULT_CHUNK_DURATION = 30  # seconds
DEFAULT_OVERLAP = 5  # seconds

# Seuil RMS pour detecter le silence (skip la transcription si en dessous)
SILENCE_RMS_THRESHOLD = 200  # sur echelle int16 (0-32768), ~200 = silence / bruit de fond

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ministral-3:3b")


def parse_bool_env(name: str) -> bool | None:
    value = os.getenv(name)
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"Valeur invalide pour {name}: {value}")


def resolve_radio_source_mode(explicit_mode: str | None = None) -> str:
    """
    Resolve radio source mode.

    Supported modes:
      - auto: prefer webradio, fallback to line-in if available
      - web: use webradio only
      - line-in: use local input only
      - off: disable radio capture

    Compatibility:
      - USE_WEB_RADIO=1 -> auto
      - USE_WEB_RADIO=0 -> line-in if fallback exists, else off
    """
    if explicit_mode:
        mode = explicit_mode.strip().lower()
    else:
        mode = os.getenv("RADIO_SOURCE", "auto").strip().lower()

    if mode not in {"auto", "web", "line-in", "off"}:
        raise ValueError(f"Mode radio invalide: {mode}")

    use_web_radio = parse_bool_env("USE_WEB_RADIO")
    fallback_device = os.getenv("RADIO_FALLBACK_INPUT_DEVICE")

    if use_web_radio is None:
        return mode
    if use_web_radio:
        return "auto" if mode == "auto" else mode
    return "line-in" if fallback_device else "off"

# ── Couleurs ANSI ─────────────────────────────────────────────────────────────

class Colors:
    """Couleurs ANSI pour le terminal."""

    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

    BG_RED = "\033[41m"
    BG_YELLOW = "\033[43m"
    BG_CYAN = "\033[46m"

    @classmethod
    def disable(cls):
        """Desactive toutes les couleurs."""
        for attr in dir(cls):
            if attr.isupper() and isinstance(getattr(cls, attr), str):
                setattr(cls, attr, "")


# ── Capture du flux radio ─────────────────────────────────────────────────────

def _is_local_file(url: str) -> bool:
    """Detecte si l'URL est un fichier local (pas un flux HTTP)."""
    if url.startswith(("http://", "https://", "rtmp://", "rtsp://")):
        return False
    # file:// scheme ou chemin brut
    path = url.removeprefix("file://")
    return os.path.isfile(path)


class StreamCapture:
    """
    Capture un flux audio HTTP ou un fichier local via ffmpeg et expose le PCM brut.

    Pour les fichiers locaux :
    - -re : lecture a vitesse temps reel (sinon ffmpeg lit aussi vite que possible)
    - -stream_loop -1 : boucle infinie (pratique pour les demos)

    Optimisations audio pour la transcription :
    - Filtre passe-haut 100Hz : coupe les basses (musique de fond, bruit)
    - Filtre passe-bas 8000Hz : coupe les aigus inutiles pour la parole
    - Normalisation dynaudnorm : nivelle le volume pour un STT plus fiable
    - Mono 16kHz s16le : format natif Whisper, zero conversion cote Python
    """

    def __init__(self, url: str, sample_rate: int = SAMPLE_RATE,
                 channels: int = CHANNELS, verbose: bool = False):
        self.url = url
        self.sample_rate = sample_rate
        self.channels = channels
        self.verbose = verbose
        self.process: subprocess.Popen | None = None
        self.is_file = _is_local_file(url)

    def start(self):
        """Lance ffmpeg pour capturer le flux ou lire un fichier local."""
        # Filtres audio optimises pour la transcription vocale
        audio_filters = ",".join([
            "highpass=f=100",       # coupe < 100Hz (basses, bruit)
            "lowpass=f=8000",       # coupe > 8kHz (aigus inutiles pour la parole)
            "dynaudnorm=p=0.9",    # normalise le volume dynamiquement
        ])

        input_path = self.url.removeprefix("file://") if self.url.startswith("file://") else self.url

        # Construction de la commande ffmpeg
        cmd = ["ffmpeg"]

        if self.is_file:
            # Fichier local : lecture temps reel + boucle infinie
            cmd += ["-re", "-stream_loop", "-1"]
        else:
            # Flux HTTP : reconnexion automatique
            cmd += ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "30"]

        cmd += [
            "-i", input_path,
            "-af", audio_filters,
            "-f", "s16le",
            "-acodec", "pcm_s16le",
            "-ar", str(self.sample_rate),
            "-ac", str(self.channels),
            "-loglevel", "warning" if self.verbose else "error",
            "pipe:1",
        ]

        stderr_target = None if self.verbose else subprocess.DEVNULL

        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=stderr_target,
        )
        source_label = f"fichier local (boucle)" if self.is_file else "flux HTTP"
        print(f"  {Colors.GREEN}[STREAM]{Colors.RESET} ffmpeg demarre — {source_label} (PID {self.process.pid})")

    def read_chunk(self, duration_seconds: float) -> bytes | None:
        """
        Lit exactement `duration_seconds` de PCM depuis le flux.
        Retourne None si le flux est coupe.
        """
        if self.process is None or self.process.stdout is None:
            return None

        num_bytes = int(duration_seconds * self.sample_rate * self.channels * BYTES_PER_SAMPLE)
        data = b""

        while len(data) < num_bytes:
            remaining = num_bytes - len(data)
            chunk = self.process.stdout.read(remaining)
            if not chunk:
                # Flux coupe ou ffmpeg termine
                return None if not data else data
            data += chunk

        return data

    def stop(self):
        """Arrete ffmpeg proprement."""
        if self.process is not None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
            print(f"  {Colors.DIM}[STREAM] ffmpeg arrete{Colors.RESET}")
            self.process = None

    def is_alive(self) -> bool:
        """Verifie si ffmpeg tourne encore."""
        if self.process is None:
            return False
        return self.process.poll() is None


def resolve_input_device(spec: str) -> int:
    """Resolve a sounddevice input by index or unique substring."""
    devices = sd.query_devices()

    if spec.isdigit():
        matches = [(int(spec), devices[int(spec)])] if int(spec) < len(devices) else []
    else:
        needle = spec.casefold()
        matches = [
            (index, device)
            for index, device in enumerate(devices)
            if needle in str(device["name"]).casefold()
        ]

    if not matches:
        raise ValueError(f"Aucun device d'entree audio ne correspond a: {spec}")
    if len(matches) > 1:
        names = ", ".join(f"[{index}] {device['name']}" for index, device in matches)
        raise ValueError(f"Plusieurs devices correspondent a {spec}: {names}")

    index, device = matches[0]
    if int(device["max_input_channels"]) < 1:
        raise ValueError(f"Le device {index} n'a pas d'entree audio: {device['name']}")
    return index


class LocalInputCapture:
    """
    Capture une entree audio locale via sounddevice.

    Utilise RawInputStream pour produire directement du PCM s16le,
    compatible avec le pipeline radio existant.
    """

    def __init__(self, device_spec: str, sample_rate: int = SAMPLE_RATE,
                 channels: int = CHANNELS, verbose: bool = False):
        self.device_spec = device_spec
        self.sample_rate = sample_rate
        self.channels = channels
        self.verbose = verbose
        self.device_index: int | None = None
        self.stream: sd.RawInputStream | None = None
        self._queue: queue.Queue[bytes] = queue.Queue()
        self._running = False

    def _callback(self, indata, _frames, _time, status):
        if status and self.verbose:
            print(f"  {Colors.DIM}[LINE-IN] {status}{Colors.RESET}")
        self._queue.put(bytes(indata))

    def start(self):
        self.device_index = resolve_input_device(self.device_spec)
        self.stream = sd.RawInputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype="int16",
            device=self.device_index,
            callback=self._callback,
            blocksize=1024,
        )
        self.stream.start()
        self._running = True
        device_name = sd.query_devices(self.device_index)["name"]
        print(f"  {Colors.YELLOW}[LINE-IN]{Colors.RESET} capture locale demarree sur [{self.device_index}] {device_name}")

    def read_chunk(self, duration_seconds: float) -> bytes | None:
        if not self._running:
            return None

        num_bytes = int(duration_seconds * self.sample_rate * self.channels * BYTES_PER_SAMPLE)
        data = b""

        while len(data) < num_bytes and self._running:
            try:
                data += self._queue.get(timeout=1.0)
            except queue.Empty:
                continue

        return data if data else None

    def stop(self):
        self._running = False
        if self.stream is not None:
            self.stream.stop()
            self.stream.close()
            self.stream = None

    def is_alive(self) -> bool:
        return self._running and self.stream is not None and self.stream.active


class FailoverCapture:
    """
    Capture radio avec priorite au flux web et fallback optionnel vers line-in.

    Regle:
      - source nominale = webradio via ffmpeg
      - source de secours = entree audio locale uniquement si la webradio est indisponible
    """

    def __init__(self, url: str, fallback_input_device: str | None = None,
                 sample_rate: int = SAMPLE_RATE, channels: int = CHANNELS,
                 verbose: bool = False, mode: str = "auto"):
        self.url = url
        self.verbose = verbose
        self.mode = resolve_radio_source_mode(mode)
        self.primary = StreamCapture(url, sample_rate=sample_rate, channels=channels, verbose=verbose)
        self.fallback = (
            LocalInputCapture(fallback_input_device, sample_rate=sample_rate, channels=channels, verbose=verbose)
            if fallback_input_device
            else None
        )
        self.active: StreamCapture | LocalInputCapture | None = None

    def start(self):
        if self.mode == "off":
            print(f"  {Colors.DIM}[RADIO]{Colors.RESET} source radio desactivee")
            self.active = None
            return

        if self.mode == "line-in":
            if self.fallback is None:
                raise ValueError("RADIO_SOURCE=line-in requiert RADIO_FALLBACK_INPUT_DEVICE")
            self.fallback.start()
            self.active = self.fallback
            print(f"  {Colors.YELLOW}[RADIO]{Colors.RESET} source active: line-in")
            return

        try:
            self.primary.start()
            self.active = self.primary
            print(f"  {Colors.GREEN}[RADIO]{Colors.RESET} source active: webradio")
        except Exception:
            if self.mode == "web" or self.fallback is None:
                raise
            print(f"  {Colors.YELLOW}[RADIO]{Colors.RESET} webradio indisponible au demarrage, bascule sur line-in")
            self.fallback.start()
            self.active = self.fallback

    def _switch_to_fallback(self) -> bool:
        if self.fallback is None:
            return False
        if self.active is self.fallback:
            return True

        print(f"  {Colors.YELLOW}[RADIO]{Colors.RESET} bascule vers line-in (webradio inaccessible)")
        self.primary.stop()
        self.fallback.start()
        self.active = self.fallback
        return True

    def read_chunk(self, duration_seconds: float) -> bytes | None:
        if self.active is None:
            return None

        data = self.active.read_chunk(duration_seconds)
        if data is not None:
            return data

        if self.active is self.primary and self._switch_to_fallback():
            return self.active.read_chunk(duration_seconds)

        return None

    def stop(self):
        self.primary.stop()
        if self.fallback is not None:
            self.fallback.stop()
        self.active = None

    def is_alive(self) -> bool:
        if self.mode == "off":
            return False
        if self.active is self.primary:
            return self.primary.is_alive() or self.fallback is not None
        if self.active is self.fallback:
            return self.fallback.is_alive()
        return False


# ── Conversion PCM → WAV ─────────────────────────────────────────────────────

def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = SAMPLE_RATE,
               channels: int = CHANNELS) -> bytes:
    """Emballe du PCM brut (s16le) dans un conteneur WAV."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(BYTES_PER_SAMPLE)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


# ── Normalisation de texte (accents, casse) ───────────────────────────────────

def normalize_text(text: str) -> str:
    """Minuscule + suppression des accents pour le matching."""
    text = text.lower()
    # NFD decompose les caracteres accentues, on retire les combining marks
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# ── Buffer glissant de transcriptions ────────────────────────────────────────

class TranscriptBuffer:
    """
    Buffer glissant qui garde les N dernieres secondes de texte transcrit.

    Chaque entree est un tuple (timestamp, texte).
    Le buffer se vide automatiquement des entrees trop anciennes.
    """

    def __init__(self, max_age_seconds: float = 20.0):
        self.max_age = max_age_seconds
        self._entries: list[tuple[float, str]] = []

    def add(self, text: str, timestamp: float | None = None) -> None:
        """Ajoute un texte transcrit au buffer."""
        ts = timestamp if timestamp is not None else time.time()
        self._entries.append((ts, text.strip()))
        self._trim()

    def _trim(self) -> None:
        """Supprime les entrees plus vieilles que max_age."""
        cutoff = time.time() - self.max_age
        self._entries = [(t, txt) for t, txt in self._entries if t >= cutoff]

    def get_text(self) -> str:
        """Retourne tout le texte du buffer concatene."""
        self._trim()
        return " ".join(txt for _, txt in self._entries if txt)

    def get_text_since(self, since: float) -> str:
        """Retourne le texte ajoute depuis un timestamp donne."""
        return " ".join(txt for t, txt in self._entries if t >= since and txt)

    def clear(self) -> None:
        """Vide le buffer."""
        self._entries.clear()

    def __len__(self) -> int:
        self._trim()
        return len(self._entries)


# ── Detection de keywords (trigger) ─────────────────────────────────────────

def extract_context(text: str, position: int, keyword_len: int, window: int = 80) -> str:
    """Extrait le texte autour d'un keyword match avec une fenetre de `window` chars."""
    start = max(0, position - window)
    end = min(len(text), position + keyword_len + window)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return prefix + text[start:end].strip() + suffix


def detect_keywords(text: str) -> list[dict]:
    """
    Cherche les keywords d'alerte dans un texte transcrit (trigger uniquement).

    Retourne une liste de dict avec keyword, position, context.
    Ne fait PAS d'analyse LLM — c'est juste le trigger.
    La classification (severity, type) est faite par le LLM ensuite.
    """
    normalized = normalize_text(text)
    matches = []

    for keyword in ALERT_KEYWORDS:
        norm_keyword = normalize_text(keyword)
        pos = normalized.find(norm_keyword)
        if pos >= 0:
            matches.append({
                "keyword": keyword,
                "position": pos,
                "context": extract_context(text, pos, len(keyword)),
            })

    return matches


# Keep old name as alias for standalone CLI
detect_alerts = detect_keywords


def classify_with_llm(text: str) -> dict | None:
    """
    Classifie un extrait radio (40s de contexte) via Ollama.

    Recoit le texte complet (20s avant trigger + 20s apres) et determine :
    - is_alert : true/false
    - severity : critical/warning/info/none
    - type : inondation/seisme/tempete/...
    - summary : resume en une phrase

    Retourne le dict parse ou None en cas d'erreur.
    """
    raw = ""
    try:
        from ollama import Client  # type: ignore[import-untyped]

        client = Client(host=OLLAMA_HOST)
        t0 = time.time()
        response = client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": ALERT_CLASSIFICATION_PROMPT},
                {"role": "user", "content": text},
            ],
            keep_alive=-1,
        )
        raw = response.message.content.strip()
        duration_ms = int((time.time() - t0) * 1000)

        result = json.loads(raw)
        result["llm_duration_ms"] = duration_ms
        return result
    except json.JSONDecodeError:
        print(f"  {Colors.DIM}[LLM] Reponse non-JSON : {raw[:200]}{Colors.RESET}")
        return None
    except Exception as e:
        print(f"  {Colors.DIM}[LLM] Erreur : {e}{Colors.RESET}")
        return None


# ── Filtrage des hallucinations Whisper ───────────────────────────────────────

# Whisper genere parfois du texte fantome sur le silence ou la musique
def is_hallucination(text: str) -> bool:
    """Detecte les hallucinations typiques de Whisper (texte trop court)."""
    normalized = normalize_text(text.strip())
    return len(normalized) < 5


# ── Detection de silence (skip STT si pas de parole) ─────────────────────────

def compute_rms(pcm_bytes: bytes) -> float:
    """Calcule le RMS (Root Mean Square) d'un buffer PCM s16le."""
    n_samples = len(pcm_bytes) // BYTES_PER_SAMPLE
    if n_samples == 0:
        return 0.0
    samples = struct.unpack(f"<{n_samples}h", pcm_bytes[:n_samples * BYTES_PER_SAMPLE])
    sum_sq = sum(s * s for s in samples)
    return math.sqrt(sum_sq / n_samples)


def is_silence(pcm_bytes: bytes, threshold: float = SILENCE_RMS_THRESHOLD) -> bool:
    """Retourne True si le chunk PCM est du silence / bruit de fond."""
    return compute_rms(pcm_bytes) < threshold


# ── Affichage console ─────────────────────────────────────────────────────────

def format_output(chunk_index: int, timestamp: datetime, text: str,
                  alerts: list[dict], stt_duration_ms: int):
    """Affiche un chunk transcrit avec les alertes eventuelles."""
    ts = timestamp.strftime("%H:%M:%S")
    header = f"  {Colors.DIM}[{ts}]{Colors.RESET} {Colors.DIM}chunk #{chunk_index} — STT {stt_duration_ms}ms{Colors.RESET}"
    print(header)

    # Texte transcrit
    if text.strip():
        print(f"  {Colors.WHITE}{text.strip()}{Colors.RESET}")
    else:
        print(f"  {Colors.DIM}(silence / pas de parole){Colors.RESET}")

    # Keywords triggers detectes
    if alerts:
        kw_list = ", ".join(sorted(set(a["keyword"] for a in alerts)))
        print(f"  {Colors.YELLOW}{Colors.BOLD}  >>> TRIGGER : {kw_list} {Colors.RESET}")

        for a in alerts:
            ctx = a.get("context", "")
            if ctx:
                print(f"    {Colors.DIM}[ctx] \"{ctx}\"{Colors.RESET}")

        # Classification LLM si presente
        llm = alerts[0].get("llm")
        if llm and llm.get("is_alert"):
            summary = llm.get("summary", "")
            sev = llm.get("severity", "?")
            atype = llm.get("type", "?")
            print(f"  {Colors.BG_RED}{Colors.WHITE}{Colors.BOLD}  [LLM] {sev.upper()}/{atype} — {summary} {Colors.RESET}")
        elif llm:
            print(f"  {Colors.DIM}  [LLM] Faux positif — {llm.get('summary', '')}{Colors.RESET}")

    print()  # Ligne vide entre les chunks


# ── Logging JSONL ─────────────────────────────────────────────────────────────

def get_max_severity(alerts: list[dict]) -> str | None:
    """Retourne le tier le plus severe parmi les alertes (si present)."""
    tiers = {a.get("tier") for a in alerts if a.get("tier")}
    for tier in ["critical", "warning", "info"]:
        if tier in tiers:
            return tier
    return None


def log_jsonl(filepath: str, chunk_index: int, timestamp: datetime,
              text: str, alerts: list[dict], stt_duration_ms: int):
    """Ajoute une ligne JSON au fichier de log."""
    entry = {
        "timestamp": timestamp.isoformat(),
        "chunk_index": chunk_index,
        "text": text.strip(),
        "triggers": [
            {
                "keyword": a["keyword"],
                "context": a.get("context", ""),
            }
            for a in alerts
        ],
        "has_alert": len(alerts) > 0,
        "alert_keywords": sorted(set(a["keyword"] for a in alerts)) if alerts else [],
        "stt_duration_ms": stt_duration_ms,
    }

    # Ajoute la classification LLM si presente
    llm = next((a.get("llm") for a in alerts if a.get("llm")), None)
    if llm:
        entry["llm_classification"] = llm

    with open(filepath, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


# ── Boucle principale ────────────────────────────────────────────────────────

_running = True
_stats = {"chunks": 0, "alerts": 0, "start_time": None}


def _signal_handler(_signum, _frame):
    """Gestion propre de Ctrl+C."""
    global _running
    _running = False


def monitor(args):
    """Boucle principale de monitoring radio."""
    global _running, _stats

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    if args.no_color:
        Colors.disable()

    # Banner
    print()
    print(f"  {Colors.BOLD}{'=' * 52}{Colors.RESET}")
    print(f"  {Colors.BOLD}  rAIdio — Monitoring radio en continu{Colors.RESET}")
    print(f"  {Colors.BOLD}{'=' * 52}{Colors.RESET}")
    print(f"  {Colors.DIM}Flux    : {args.url}{Colors.RESET}")
    if args.fallback_input_device:
        print(f"  {Colors.DIM}Fallback: {args.fallback_input_device}{Colors.RESET}")
    print(f"  {Colors.DIM}Chunk   : {args.chunk_duration}s (overlap {args.overlap}s){Colors.RESET}")
    print(f"  {Colors.DIM}LLM     : {'active' if args.use_llm else 'desactive'}{Colors.RESET}")
    if args.log_file:
        print(f"  {Colors.DIM}Log     : {args.log_file}{Colors.RESET}")
    print()

    capture = FailoverCapture(
        args.url,
        fallback_input_device=args.fallback_input_device,
        verbose=args.verbose,
    )
    overlap_buffer = b""
    chunk_index = 0
    backoff = 2
    _stats["start_time"] = time.time()

    # Demarrage initial
    try:
        capture.start()
    except FileNotFoundError:
        print(f"  {Colors.RED}ERREUR : ffmpeg introuvable. Installez-le avec :{Colors.RESET}")
        print(f"  sudo apt install ffmpeg")
        sys.exit(1)

    # Petite pause pour laisser ffmpeg se connecter
    time.sleep(1)

    print(f"  {Colors.GREEN}En ecoute... (Ctrl+C pour arreter){Colors.RESET}\n")

    while _running:
        # Verifier que ffmpeg tourne
        if not capture.is_alive():
            print(f"  {Colors.YELLOW}[STREAM] Deconnecte, reconnexion dans {backoff}s...{Colors.RESET}")
            capture.stop()

            for i in range(backoff):
                if not _running:
                    break
                time.sleep(1)

            if not _running:
                break

            backoff = min(backoff * 2, 60)
            try:
                capture.start()
                time.sleep(1)
            except Exception as e:
                print(f"  {Colors.RED}[STREAM] Erreur reconnexion : {e}{Colors.RESET}")
            continue

        # Lire le nouveau segment audio (chunk - overlap)
        new_duration = args.chunk_duration - args.overlap if overlap_buffer else args.chunk_duration
        new_pcm = capture.read_chunk(new_duration)

        if new_pcm is None:
            continue  # flux coupe, la boucle detectera is_alive() == False

        # Assembler avec l'overlap du chunk precedent
        full_pcm = overlap_buffer + new_pcm

        # Garder les dernières secondes pour l'overlap suivant
        overlap_bytes = int(args.overlap * SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE)
        if len(new_pcm) >= overlap_bytes:
            overlap_buffer = new_pcm[-overlap_bytes:]
        else:
            overlap_buffer = new_pcm

        # Reset backoff au succes
        backoff = 2

        # Skip si silence (evite de lancer Whisper inutilement)
        rms = compute_rms(full_pcm)
        if is_silence(full_pcm):
            if args.verbose:
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"  {Colors.DIM}[{ts}] (silence, RMS={rms:.0f}, skip STT){Colors.RESET}\n")
            chunk_index += 1
            _stats["chunks"] += 1
            continue

        # Convertir PCM → WAV
        wav_bytes = pcm_to_wav(full_pcm)

        # Transcrire avec Whisper
        try:
            stt_result = transcribe(wav_bytes)
        except Exception as e:
            print(f"  {Colors.RED}[STT] Erreur : {e}{Colors.RESET}")
            continue

        text = stt_result.get("text", "")
        stt_ms = stt_result.get("duration_ms", 0)

        # Filtrer les hallucinations
        if is_hallucination(text):
            if args.verbose:
                print(f"  {Colors.DIM}[{datetime.now().strftime('%H:%M:%S')}] (hallucination filtree: '{text[:50]}'){Colors.RESET}\n")
            chunk_index += 1
            _stats["chunks"] += 1
            continue

        # Detecter les alertes (keyword trigger + LLM optionnel)
        alerts = detect_keywords(text)
        if args.use_llm and alerts:
            llm_result = classify_with_llm(text)
            if llm_result:
                for alert in alerts:
                    alert["llm"] = llm_result
        _stats["chunks"] += 1
        _stats["alerts"] += len(alerts)

        # Avertir si STT plus lent que le chunk
        if stt_ms > args.chunk_duration * 1000:
            print(f"  {Colors.YELLOW}[PERF] STT ({stt_ms}ms) plus lent que le chunk ({args.chunk_duration}s) — augmentez --chunk-duration{Colors.RESET}")

        # Afficher
        now = datetime.now()
        format_output(chunk_index, now, text, alerts, stt_ms)

        # Logger
        if args.log_file:
            log_jsonl(args.log_file, chunk_index, now, text, alerts, stt_ms)

        chunk_index += 1

    # Arret propre
    capture.stop()
    _print_summary()


def _print_summary():
    """Affiche un resume a la fin du monitoring."""
    elapsed = time.time() - _stats["start_time"] if _stats["start_time"] else 0
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    print()
    print(f"  {Colors.BOLD}{'=' * 52}{Colors.RESET}")
    print(f"  {Colors.BOLD}  Resume du monitoring{Colors.RESET}")
    print(f"  {Colors.BOLD}{'=' * 52}{Colors.RESET}")
    print(f"  Duree          : {minutes}m {seconds}s")
    print(f"  Chunks traites : {_stats['chunks']}")
    print(f"  Alertes        : {_stats['alerts']}")
    print(f"  {Colors.BOLD}{'=' * 52}{Colors.RESET}")
    print()


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="rAIdio — Monitoring radio web en continu",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples :
  uv run python radio_monitor.py
  uv run python radio_monitor.py --url http://icecast.radiofrance.fr/franceinter-midfi.mp3
  uv run python radio_monitor.py --use-llm --log-file alerts.jsonl
  uv run python radio_monitor.py --chunk-duration 20 --overlap 3
        """,
    )
    parser.add_argument(
        "--url", type=str, default=DEFAULT_STREAM_URL,
        help=f"URL du flux radio (defaut: France Info)",
    )
    parser.add_argument(
        "--chunk-duration", type=int, default=DEFAULT_CHUNK_DURATION,
        help=f"Duree des chunks en secondes (defaut: {DEFAULT_CHUNK_DURATION})",
    )
    parser.add_argument(
        "--overlap", type=int, default=DEFAULT_OVERLAP,
        help=f"Overlap entre chunks en secondes (defaut: {DEFAULT_OVERLAP})",
    )
    parser.add_argument(
        "--use-llm", action="store_true",
        help="Activer la classification LLM des alertes detectees",
    )
    parser.add_argument(
        "--fallback-input-device", type=str, default=os.getenv("RADIO_FALLBACK_INPUT_DEVICE"),
        help="Device audio local de secours, utilise seulement si la webradio est inaccessible.",
    )
    parser.add_argument(
        "--log-file", type=str, default=None,
        help="Chemin du fichier de log JSONL",
    )
    parser.add_argument(
        "--no-color", action="store_true",
        help="Desactiver les couleurs ANSI",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Afficher les logs ffmpeg et le debug",
    )

    args = parser.parse_args()

    # Validation
    if args.overlap >= args.chunk_duration:
        print(f"Erreur : --overlap ({args.overlap}s) doit etre < --chunk-duration ({args.chunk_duration}s)")
        sys.exit(1)

    monitor(args)


if __name__ == "__main__":
    main()
