"""
STT module — Speech-to-Text via whisper.cpp (pywhispercpp)

Config:
    - STT_MODEL=tiny|base|small|medium|large
    - WHISPER_MODEL=... (legacy alias if STT_MODEL is not set)
    - WHISPER_THREADS=...
"""

import tempfile
import time
import os
from pathlib import Path

STT_MODEL = os.getenv("STT_MODEL", os.getenv("WHISPER_MODEL", "base"))
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "fr")
WHISPER_THREADS = int(os.getenv("WHISPER_THREADS", "4"))

_model = None


def _get_model():
    """Load the whisper.cpp model once (lazy singleton)."""
    from pywhispercpp.model import Model

    global _model
    if _model is None:
        print(f"[STT] Loading whisper.cpp model '{STT_MODEL}'...")
        t0 = time.time()
        _model = Model(STT_MODEL, n_threads=WHISPER_THREADS)
        print(f"[STT] whisper.cpp loaded in {time.time() - t0:.1f}s")
    return _model


def _transcribe(model, tmp_path: str) -> str:
    segments = model.transcribe(
        tmp_path,
        language=WHISPER_LANGUAGE,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()


def transcribe(audio_bytes: bytes) -> dict:
    """
    Transcribe raw audio bytes (WAV format) to text.

    Returns:
        {
            "text": str,         # transcribed text
            "duration_ms": int   # processing time in ms
        }
    """
    model = _get_model()

    # whisper.cpp expects a file path.
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        t0 = time.time()
        text = _transcribe(model, tmp_path)
        duration_ms = int((time.time() - t0) * 1000)

        print(f"[STT] (whispercpp/{STT_MODEL}) Transcribed in {duration_ms}ms: '{text[:80]}...'")
        return {"text": text, "duration_ms": duration_ms}
    finally:
        Path(tmp_path).unlink(missing_ok=True)
