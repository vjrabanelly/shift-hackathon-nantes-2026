#!/usr/bin/env python3
"""
rAIdio CLI — Push-to-Talk depuis un micro local

Usage:
    uv run python cli.py                     # micro par défaut
    uv run python cli.py --device 2          # micro spécifique (voir --list)
    uv run python cli.py --list              # lister les devices audio
    uv run python cli.py --key space         # touche PTT (défaut: espace)

Pipeline:  PTT (clavier) → Mic → STT → LLM → TTS → Speaker local
Indépendant du serveur web — appelle les modules directement.
"""

import argparse
import io
import sys
import wave

import sounddevice as sd
import soundfile as sf
import numpy as np

from stt import transcribe
from llm import ask, warmup as llm_warmup
from text_utils import strip_markdown
from tts import synthesize

# ---- Config ----
SAMPLE_RATE = 16000
CHANNELS = 1


def list_devices():
    """Affiche les devices audio disponibles."""
    print("\n🎤 Devices audio disponibles :\n")
    print(sd.query_devices())
    print(f"\n  Device d'entrée par défaut : {sd.default.device[0]}")
    print(f"  Device de sortie par défaut : {sd.default.device[1]}")


def record_ptt(device=None) -> bytes:
    """
    Enregistre depuis le micro tant que la touche est maintenue.
    Retourne les bytes WAV.
    """
    frames = []
    recording = True

    def callback(indata, _frame_count, _time_info, status):
        if status:
            print(f"  [Mic] {status}", file=sys.stderr)
        if recording:
            frames.append(indata.copy())

    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype='float32',
        device=device,
        callback=callback,
        blocksize=1024,
    )

    print("  🎙️  ENREGISTREMENT... (relâche Entrée pour arrêter)")
    stream.start()

    # Bloque jusqu'à Entrée
    input()

    recording = False
    stream.stop()
    stream.close()

    if not frames:
        return b""

    # Concat et conversion float32 → int16 WAV
    audio = np.concatenate(frames, axis=0).flatten()
    duration = len(audio) / SAMPLE_RATE
    print(f"  📼 Enregistré: {duration:.1f}s ({len(audio)} samples)")

    # Encode en WAV bytes
    int_samples = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(int_samples.tobytes())
    return buf.getvalue()


def play_audio(wav_bytes: bytes, device=None):
    """Joue un fichier WAV sur le speaker."""
    buf = io.BytesIO(wav_bytes)
    data, samplerate = sf.read(buf)
    channels = 1 if np.asarray(data).ndim == 1 else int(np.asarray(data).shape[1])
    try:
        sd.check_output_settings(device=device, samplerate=samplerate, channels=channels)
        playback_data = data
        playback_rate = samplerate
    except sd.PortAudioError:
        candidates = [samplerate, 48000, 44100, 32000, 24000, 22050, 16000, 8000]
        fallback_rate = None
        for rate in candidates:
            try:
                sd.check_output_settings(device=device, samplerate=rate, channels=channels)
                fallback_rate = rate
                break
            except sd.PortAudioError:
                continue
        if fallback_rate is None:
            device_info = sd.query_devices(device, "output")
            fallback_rate = int(device_info["default_samplerate"])
        source = np.asarray(data)
        if source.ndim == 1:
            source = source[:, np.newaxis]
        source_len = source.shape[0]
        target_len = max(1, int(round(source_len * fallback_rate / samplerate)))
        source_positions = np.linspace(0.0, source_len - 1, num=source_len)
        target_positions = np.linspace(0.0, source_len - 1, num=target_len)
        channels = [
            np.interp(target_positions, source_positions, source[:, channel_index])
            for channel_index in range(source.shape[1])
        ]
        resampled = np.stack(channels, axis=1).astype(np.float32)
        playback_data = resampled[:, 0] if resampled.shape[1] == 1 else resampled
        playback_rate = fallback_rate
        print(f"  🔁 Resample {samplerate}Hz -> {fallback_rate}Hz pour la sortie audio")

    sd.play(playback_data, playback_rate, device=device)
    sd.wait()


def run_pipeline(wav_bytes: bytes, output_device=None):
    """Exécute le pipeline complet STT → LLM → TTS → Speaker."""
    # STT
    print("\n  ⏳ STT...", end="", flush=True)
    stt_result = transcribe(wav_bytes)
    print(f" ✅ ({stt_result['duration_ms']}ms)")
    print(f"  📝 \"{stt_result['text']}\"")

    if not stt_result['text'].strip():
        print("  ⚠️  Aucun texte détecté, réessaie.")
        return

    # LLM
    print("  ⏳ LLM...", end="", flush=True)
    llm_result = ask(stt_result['text'])
    print(f" ✅ ({llm_result['duration_ms']}ms)")
    print(f"  🤖 \"{llm_result['text']}\"")

    # TTS
    print("  ⏳ TTS...", end="", flush=True)
    tts_result = synthesize(strip_markdown(llm_result['text']))
    print(f" ✅ ({tts_result['duration_ms']}ms)")

    # Speaker
    print("  🔊 Lecture audio...")
    play_audio(tts_result['audio_bytes'], device=output_device)
    print("  ✅ Terminé.\n")


def main():
    parser = argparse.ArgumentParser(description="rAIdio CLI — PTT micro local")
    parser.add_argument("--list", action="store_true", help="Lister les devices audio")
    parser.add_argument("--device", type=int, default=None, help="Device micro (entrée)")
    parser.add_argument("--output", type=int, default=None, help="Device speaker (sortie)")
    parser.add_argument("--no-warmup", action="store_true", help="Skip LLM warmup")
    args = parser.parse_args()

    if args.list:
        list_devices()
        return

    print("=" * 50)
    print("  rAIdio CLI — Poste radio d'urgence")
    print("=" * 50)

    # Warmup LLM
    if not args.no_warmup:
        print("\n  🔥 Chargement du modèle LLM...")
        llm_warmup()

    print("\n  ✅ Prêt !")
    print("  Appuie sur Entrée pour parler (PTT)")
    print("  Appuie sur Entrée pour arrêter l'enregistrement")
    print("  Ctrl+C pour quitter\n")

    try:
        while True:
            input("  ▶ Appuie sur Entrée pour parler...")
            wav_bytes = record_ptt(device=args.device)

            if not wav_bytes:
                print("  ⚠️  Pas d'audio capturé.")
                continue

            run_pipeline(wav_bytes, output_device=args.output)

    except KeyboardInterrupt:
        print("\n\n  👋 Bye !")


if __name__ == "__main__":
    main()
