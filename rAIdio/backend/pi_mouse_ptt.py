#!/usr/bin/env python3
"""
rAIdio Raspberry Pi runtime - mouse hold-to-talk on Linux input events.

Usage examples:
    uv run python pi_mouse_ptt.py --list-audio
    uv run python pi_mouse_ptt.py --list-mice
    uv run python pi_mouse_ptt.py \
        --radio-input "USB Audio" \
        --jabra-input "Jabra" \
        --jabra-output "Jabra" \
        --ptt-device /dev/input/event3

Expected behavior:
    - Press and hold the configured mouse button to record from the Jabra mic
    - Release the button to run STT -> LLM -> TTS
    - Play the answer on the Jabra output

Notes:
    - The radio input device is validated at startup and meant for backend radio-monitor fallback.
    - Access to /dev/input/event* usually requires root or membership in `input`.
"""

from __future__ import annotations

import argparse
import io
import os
import select
import struct
import sys
import time
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import requests
import sounddevice as sd
import soundfile as sf

from llm import ask, warmup as llm_warmup
from stt import transcribe
from text_utils import strip_markdown
from tts import synthesize


SAMPLE_RATE = 16000
CHANNELS = 1
INPUT_EVENT_STRUCT = struct.Struct("llHHI")
EV_KEY = 0x01
BTN_LEFT = 0x110
BTN_RIGHT = 0x111
BTN_MIDDLE = 0x112


@dataclass(frozen=True)
class AudioDevice:
    index: int
    name: str
    max_input_channels: int
    max_output_channels: int
    default_samplerate: float


BUTTON_CODES = {
    "left": BTN_LEFT,
    "right": BTN_RIGHT,
    "middle": BTN_MIDDLE,
}


def list_audio_devices() -> None:
    print("\nAudio devices:\n")
    devices = sd.query_devices()
    for index, device in enumerate(devices):
        print(
            f"[{index}] {device['name']} | "
            f"in={device['max_input_channels']} out={device['max_output_channels']} "
            f"default_sr={device['default_samplerate']}"
        )
    print(f"\nDefault input: {sd.default.device[0]}")
    print(f"Default output: {sd.default.device[1]}")


def iter_mouse_devices() -> list[Path]:
    return sorted(Path("/dev/input").glob("event*"))


def read_device_name(path: Path) -> str:
    name_file = Path("/sys/class/input") / path.name / "device" / "name"
    try:
        return name_file.read_text(encoding="utf-8").strip()
    except OSError:
        return "<unknown>"


def list_mouse_devices() -> None:
    print("\nMouse/event devices:\n")
    for path in iter_mouse_devices():
        print(f"{path} | {read_device_name(path)}")


def collect_audio_devices() -> list[AudioDevice]:
    devices: list[AudioDevice] = []
    for index, raw in enumerate(sd.query_devices()):
        devices.append(
            AudioDevice(
                index=index,
                name=str(raw["name"]),
                max_input_channels=int(raw["max_input_channels"]),
                max_output_channels=int(raw["max_output_channels"]),
                default_samplerate=float(raw["default_samplerate"]),
            )
        )
    return devices


def resolve_audio_device(spec: str | None, *, want_input: bool, label: str) -> int | None:
    if spec is None:
        return None

    devices = collect_audio_devices()
    if spec.isdigit():
        index = int(spec)
        matches = [device for device in devices if device.index == index]
    else:
        needle = spec.casefold()
        matches = [device for device in devices if needle in device.name.casefold()]

    if not matches:
        raise ValueError(f"No audio device matched {label}: {spec}")
    if len(matches) > 1:
        names = ", ".join(f"[{device.index}] {device.name}" for device in matches)
        raise ValueError(f"Multiple audio devices matched {label}: {spec} -> {names}")

    device = matches[0]
    channel_count = device.max_input_channels if want_input else device.max_output_channels
    if channel_count < 1:
        kind = "input" if want_input else "output"
        raise ValueError(f"Audio device {device.index} cannot be used as {kind}: {device.name}")

    return device.index


def validate_mouse_device(path_str: str) -> Path:
    path = Path(path_str)
    if not path.exists():
        raise FileNotFoundError(f"Mouse event device not found: {path}")
    if not path.is_char_device():
        raise ValueError(f"Mouse event path is not a device: {path}")
    return path


def encode_wav_bytes(float_audio: np.ndarray) -> bytes:
    int_samples = np.clip(float_audio * 32767, -32768, 32767).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(CHANNELS)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(int_samples.tobytes())
    return buffer.getvalue()


def resample_audio(data: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    """Resample audio with linear interpolation for device compatibility."""
    if source_rate == target_rate:
        return data

    if data.ndim == 1:
        data = data[:, np.newaxis]

    source_len = data.shape[0]
    target_len = max(1, int(round(source_len * target_rate / source_rate)))
    source_positions = np.linspace(0.0, source_len - 1, num=source_len)
    target_positions = np.linspace(0.0, source_len - 1, num=target_len)

    channels = [
        np.interp(target_positions, source_positions, data[:, channel_index])
        for channel_index in range(data.shape[1])
    ]
    resampled = np.stack(channels, axis=1).astype(np.float32)
    return resampled[:, 0] if resampled.shape[1] == 1 else resampled


def pick_output_sample_rate(output_device: int | None, source_rate: int, channels: int) -> int:
    """Pick a playback sample rate actually supported by the output device."""
    candidates = [
        source_rate,
        48000,
        44100,
        32000,
        24000,
        22050,
        16000,
        8000,
    ]
    seen: set[int] = set()

    for rate in candidates:
        if rate in seen:
            continue
        seen.add(rate)
        try:
            sd.check_output_settings(device=output_device, samplerate=rate, channels=channels)
            return rate
        except sd.PortAudioError:
            continue

    device_info = sd.query_devices(output_device, "output")
    fallback_rate = int(device_info["default_samplerate"])
    sd.check_output_settings(device=output_device, samplerate=fallback_rate, channels=channels)
    return fallback_rate


def play_audio(wav_bytes: bytes, output_device: int | None) -> None:
    with io.BytesIO(wav_bytes) as buffer:
        data, sample_rate = sf.read(buffer)
    channels = 1 if np.asarray(data).ndim == 1 else int(np.asarray(data).shape[1])
    try:
        sd.check_output_settings(device=output_device, samplerate=sample_rate, channels=channels)
        playback_data = data
        playback_rate = sample_rate
    except sd.PortAudioError:
        playback_rate = pick_output_sample_rate(output_device, sample_rate, channels)
        print(f"  [AUDIO] Resampling output from {sample_rate}Hz to {playback_rate}Hz for device compatibility.")
        playback_data = resample_audio(np.asarray(data), sample_rate, playback_rate)

    sd.play(playback_data, playback_rate, device=output_device)
    sd.wait()


def run_pipeline(wav_bytes: bytes, output_device: int | None) -> None:
    print("\n  [PIPELINE] STT...", end="", flush=True)
    stt_result = transcribe(wav_bytes)
    print(f" ok ({stt_result['duration_ms']}ms)")
    print(f"  [STT] {stt_result['text']!r}")

    if not stt_result["text"].strip():
        print("  [STT] Empty transcription, skipping response.")
        return

    print("  [PIPELINE] LLM...", end="", flush=True)
    llm_result = ask(stt_result["text"])
    print(f" ok ({llm_result['duration_ms']}ms)")
    print(f"  [LLM] {llm_result['text']!r}")

    print("  [PIPELINE] TTS...", end="", flush=True)
    tts_text = strip_markdown(llm_result["text"])
    tts_result = synthesize(tts_text)
    print(f" ok ({tts_result['duration_ms']}ms)")

    print("  [PIPELINE] Playback...")
    play_audio(tts_result["audio_bytes"], output_device=output_device)
    print("  [PIPELINE] Done.\n")


DOUBLE_CLICK_THRESHOLD = 0.4  # seconds between two presses to count as double-click
MIN_PTT_DURATION = 0.15  # minimum hold duration (seconds) to count as a PTT (not a click)

RECALL_URL = os.getenv("RAIDIO_RECALL_URL", "http://localhost:8000/api/recall")
INTERACTION_SIGNAL_URL = os.getenv(
    "RAIDIO_INTERACTION_SIGNAL_URL",
    "http://localhost:8000/api/interaction",
)


def _signal_interaction(state: str) -> None:
    try:
        requests.post(f"{INTERACTION_SIGNAL_URL}/{state}", timeout=1)
    except requests.RequestException:
        pass


def recall_alerts(output_device: int | None) -> None:
    """Call the server /api/recall endpoint and play the TTS response."""
    print("  [RECALL] Rappel des alertes...")
    _signal_interaction("start")
    try:
        resp = requests.post(RECALL_URL, timeout=30)
        if resp.status_code != 200:
            print(f"  [RECALL] Erreur serveur: {resp.status_code} {resp.text[:100]}")
            return
        wav_bytes = resp.content
        duration_ms = resp.headers.get("X-Duration-Ms", "?")
        text_len = resp.headers.get("X-Text-Length", "?")
        print(f"  [RECALL] Recu {len(wav_bytes)} bytes WAV (TTS {duration_ms}ms, texte {text_len} chars)")
        play_audio(wav_bytes, output_device=output_device)
        print("  [RECALL] Done.\n")
    except requests.ConnectionError:
        print("  [RECALL] Erreur: serveur inaccessible")
    except Exception as e:
        print(f"  [RECALL] Erreur: {e}")
    finally:
        _signal_interaction("end")


class MouseHoldToTalk:
    def __init__(self, input_device: int | None, output_device: int | None, mouse_path: Path, button: str):
        self.input_device = input_device
        self.output_device = output_device
        self.mouse_path = mouse_path
        self.button_code = BUTTON_CODES[button]
        self._frames: list[np.ndarray] = []
        self._recording = False
        self._stream: sd.InputStream | None = None
        self._interaction_active = False
        # Double-click detection
        self._last_press_time: float = 0.0
        self._press_time: float = 0.0

    def _begin_interaction(self) -> None:
        if self._interaction_active:
            return
        self._interaction_active = True
        _signal_interaction("start")

    def _end_interaction(self) -> None:
        if not self._interaction_active:
            return
        self._interaction_active = False
        _signal_interaction("end")

    def _audio_callback(self, indata, _frame_count, _time_info, status) -> None:
        if status:
            print(f"  [MIC] {status}", file=sys.stderr)
        if self._recording:
            self._frames.append(indata.copy())

    def _start_recording(self) -> None:
        if self._recording:
            return
        self._begin_interaction()
        self._frames = []
        self._recording = True
        self._stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="float32",
            device=self.input_device,
            callback=self._audio_callback,
            blocksize=1024,
        )
        self._stream.start()
        print("  [PTT] Recording...")

    def _stop_recording(self) -> bytes:
        if not self._recording:
            return b""
        self._recording = False

        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

        if not self._frames:
            print("  [PTT] No audio captured.")
            return b""

        audio = np.concatenate(self._frames, axis=0).flatten()
        duration_s = len(audio) / SAMPLE_RATE
        print(f"  [PTT] Captured {duration_s:.2f}s")
        return encode_wav_bytes(audio)

    def _handle_button_event(self, event_type: int, event_code: int, value: int) -> None:
        if event_type != EV_KEY or event_code != self.button_code:
            return

        now = time.monotonic()

        if value == 1:
            # Button pressed — detect double-click
            gap = now - self._last_press_time
            self._last_press_time = now
            self._press_time = now

            if gap < DOUBLE_CLICK_THRESHOLD:
                # Double-click detected — cancel any recording and trigger recall
                if self._recording:
                    self._recording = False
                    if self._stream is not None:
                        self._stream.stop()
                        self._stream.close()
                        self._stream = None
                    self._frames = []
                    self._end_interaction()
                print("  [PTT] Double-clic detecte -> rappel alertes")
                recall_alerts(output_device=self.output_device)
                # Reset to avoid triple-click triggering another recall
                self._last_press_time = 0.0
                return

            self._start_recording()

        elif value == 0:
            # Button released
            hold_duration = now - self._press_time

            if hold_duration < MIN_PTT_DURATION:
                # Too short — likely a click (first of a potential double-click)
                # Cancel recording, don't run pipeline
                if self._recording:
                    self._recording = False
                    if self._stream is not None:
                        self._stream.stop()
                        self._stream.close()
                        self._stream = None
                    self._frames = []
                    self._end_interaction()
                return

            wav_bytes = self._stop_recording()
            if wav_bytes:
                try:
                    run_pipeline(wav_bytes, output_device=self.output_device)
                finally:
                    self._end_interaction()
            else:
                self._end_interaction()

    def run(self) -> None:
        print(f"  [PTT] Listening on {self.mouse_path} ({read_device_name(self.mouse_path)})")
        print(f"  [PTT] Hold button to talk, double-click for alert recall.")
        print("  [PTT] Ctrl+C to quit.\n")

        with self.mouse_path.open("rb", buffering=0) as device_file:
            while True:
                ready, _, _ = select.select([device_file], [], [])
                if device_file not in ready:
                    continue
                payload = device_file.read(INPUT_EVENT_STRUCT.size)
                if len(payload) != INPUT_EVENT_STRUCT.size:
                    continue
                _sec, _usec, event_type, event_code, value = INPUT_EVENT_STRUCT.unpack(payload)
                self._handle_button_event(event_type, event_code, value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="rAIdio Raspberry Pi runtime with mouse PTT.")
    parser.add_argument("--list-audio", action="store_true", help="List available audio devices and exit.")
    parser.add_argument("--list-mice", action="store_true", help="List available /dev/input/event* devices and exit.")
    parser.add_argument(
        "--radio-input",
        default=os.getenv("RAIDIO_RADIO_INPUT"),
        help="Radio input device index or unique name substring. Validated at startup only.",
    )
    parser.add_argument(
        "--jabra-input",
        default=os.getenv("RAIDIO_JABRA_INPUT"),
        help="Jabra microphone device index or unique name substring.",
    )
    parser.add_argument(
        "--jabra-output",
        default=os.getenv("RAIDIO_JABRA_OUTPUT"),
        help="Jabra speaker device index or unique name substring.",
    )
    parser.add_argument(
        "--ptt-device",
        default=os.getenv("RAIDIO_PTT_DEVICE"),
        help="Linux mouse event device path, for example /dev/input/event3.",
    )
    parser.add_argument(
        "--ptt-button",
        choices=sorted(BUTTON_CODES),
        default=os.getenv("RAIDIO_PTT_BUTTON", "left"),
        help="Mouse button used for hold-to-talk.",
    )
    parser.add_argument("--no-warmup", action="store_true", help="Skip LLM warmup.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.list_audio:
        list_audio_devices()
        return 0

    if args.list_mice:
        list_mouse_devices()
        return 0

    if args.jabra_input is None:
        raise ValueError("--jabra-input is required")
    if args.jabra_output is None:
        raise ValueError("--jabra-output is required")
    if args.radio_input is None:
        raise ValueError("--radio-input is required")
    if args.ptt_device is None:
        raise ValueError("--ptt-device is required")

    radio_input = resolve_audio_device(args.radio_input, want_input=True, label="radio input")
    jabra_input = resolve_audio_device(args.jabra_input, want_input=True, label="Jabra input")
    jabra_output = resolve_audio_device(args.jabra_output, want_input=False, label="Jabra output")
    mouse_path = validate_mouse_device(args.ptt_device)

    print("=" * 60)
    print("rAIdio Raspberry Pi - Mouse PTT runtime")
    print("=" * 60)
    print(f"  Radio input : [{radio_input}] {sd.query_devices(radio_input)['name']}")
    print(f"  Jabra input : [{jabra_input}] {sd.query_devices(jabra_input)['name']}")
    print(f"  Jabra output: [{jabra_output}] {sd.query_devices(jabra_output)['name']}")
    print(f"  PTT device  : {mouse_path} ({read_device_name(mouse_path)})")
    print(f"  PTT button  : {args.ptt_button}")
    print("  Radio input is reserved for radio-monitor fallback if the webradio is unreachable.\n")

    if not args.no_warmup:
        print("  [LLM] Warmup...")
        llm_warmup()

    runtime = MouseHoldToTalk(
        input_device=jabra_input,
        output_device=jabra_output,
        mouse_path=mouse_path,
        button=args.ptt_button,
    )
    runtime.run()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[EXIT] Interrupted.")
        raise SystemExit(0)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1)
