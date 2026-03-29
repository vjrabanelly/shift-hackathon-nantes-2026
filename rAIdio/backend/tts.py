"""
TTS module — Kokoro ONNX

Interface simple :
    synthesize(text: str) -> dict
"""

import io
import time
import os

import soundfile as sf
from kokoro_onnx import Kokoro

MODELS_DIR = os.getenv("KOKORO_MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))
KOKORO_VOICE = os.getenv("KOKORO_VOICE", "ff_siwis")  # seule voix française dispo
KOKORO_SPEED = float(os.getenv("KOKORO_SPEED", "1.0"))
KOKORO_LANG = os.getenv("KOKORO_LANG", "fr-fr")

_kokoro: Kokoro | None = None


def _get_kokoro() -> Kokoro:
    global _kokoro
    if _kokoro is None:
        model_path = os.path.join(MODELS_DIR, "kokoro-v1.0.onnx")
        voices_path = os.path.join(MODELS_DIR, "voices-v1.0.bin")
        print(f"[TTS] Loading Kokoro model from {model_path}")
        _kokoro = Kokoro(model_path, voices_path)
        print(f"[TTS] Kokoro ready — voice: {KOKORO_VOICE}, lang: {KOKORO_LANG}")
    return _kokoro


def synthesize(text: str) -> dict:
    """
    Synthesize text to WAV audio bytes.

    Returns:
        {
            "audio_bytes": bytes,   # WAV file content
            "sample_rate": int,
            "duration_ms": int      # processing time in ms
        }
    """
    kokoro = _get_kokoro()

    t0 = time.time()
    samples, sample_rate = kokoro.create(
        text,
        voice=KOKORO_VOICE,
        speed=KOKORO_SPEED,
        lang=KOKORO_LANG,
    )
    duration_ms = int((time.time() - t0) * 1000)

    # Convert to WAV bytes in memory
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    audio_bytes = buf.getvalue()

    audio_duration_ms = int(len(samples) / sample_rate * 1000)
    print(f"[TTS] Synthesized in {duration_ms}ms — audio duration: {audio_duration_ms}ms ({len(audio_bytes)} bytes)")

    return {
        "audio_bytes": audio_bytes,
        "sample_rate": sample_rate,
        "duration_ms": duration_ms,
    }
