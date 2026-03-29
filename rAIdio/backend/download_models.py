#!/usr/bin/env python3
"""
Download and warm up the local models required by rAIdio.

This script handles:
  - Ollama LLM model via `ollama pull`
  - whisper.cpp STT model via pywhispercpp automatic download
  - Kokoro ONNX TTS files into backend/models
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import urllib.request
from pathlib import Path


OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ministral-3:3b")
STT_MODEL = os.getenv("STT_MODEL", os.getenv("WHISPER_MODEL", "base"))
MODELS_DIR = Path(
    os.getenv("KOKORO_MODELS_DIR", Path(__file__).parent / "models")
).resolve()

KOKORO_RELEASE = "model-files-v1.0"
KOKORO_BASE_URL = (
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
    f"{KOKORO_RELEASE}"
)
KOKORO_FILES = {
    "kokoro-v1.0.onnx": f"{KOKORO_BASE_URL}/kokoro-v1.0.onnx",
    "voices-v1.0.bin": f"{KOKORO_BASE_URL}/voices-v1.0.bin",
}


def _download_file(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"[download] {destination.name} <- {url}")
    with urllib.request.urlopen(url) as response, destination.open("wb") as output:
        total = response.headers.get("Content-Length")
        total_bytes = int(total) if total else None
        downloaded = 0

        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)
            downloaded += len(chunk)
            if total_bytes:
                percent = downloaded / total_bytes * 100
                print(
                    f"\r  {downloaded / (1024 * 1024):.1f}MB / "
                    f"{total_bytes / (1024 * 1024):.1f}MB ({percent:.0f}%)",
                    end="",
                    flush=True,
                )
        if total_bytes:
            print()


def ensure_ollama_model() -> None:
    print(f"[ollama] Pulling model '{OLLAMA_MODEL}'...")
    try:
        subprocess.run(
            ["ollama", "pull", OLLAMA_MODEL],
            check=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "ollama is not installed or not available in PATH."
        ) from exc


def ensure_whisper_model() -> None:
    print(f"[stt] Ensuring whisper.cpp model '{STT_MODEL}' is available...")
    from stt import _get_model

    _get_model()


def ensure_kokoro_files() -> None:
    print(f"[tts] Ensuring Kokoro files exist in {MODELS_DIR}...")
    for filename, url in KOKORO_FILES.items():
        destination = MODELS_DIR / filename
        if destination.exists():
            print(f"[tts] Found {destination.name}")
            continue
        _download_file(url, destination)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download local models for rAIdio")
    parser.add_argument("--skip-ollama", action="store_true", help="Skip `ollama pull`")
    parser.add_argument("--skip-whisper", action="store_true", help="Skip whisper.cpp model download")
    parser.add_argument("--skip-kokoro", action="store_true", help="Skip Kokoro TTS file download")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if not args.skip_ollama:
            ensure_ollama_model()
        if not args.skip_whisper:
            ensure_whisper_model()
        if not args.skip_kokoro:
            ensure_kokoro_files()
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 1

    print("[ok] Local models are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
