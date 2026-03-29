"""
rAIdio — Generation et lecture des sons d'alerte cote serveur.

Les sons sont generes en pur Python (PCM s16le) et joues via aplay (ALSA).
Sur le Raspberry Pi, la sortie audio passe par le speaker de la radio.

Sons :
  - critical : sirene deux-tons (800Hz / 600Hz alternes, 6 bips, onde carree)
  - warning / info : triple bip doux (660Hz, onde sinusoidale)
"""

import io
import math
import os
import struct
import subprocess
import threading
import wave

SAMPLE_RATE = 44100
CHANNELS = 1
BYTES_PER_SAMPLE = 2  # s16le
ALSA_OUTPUT_DEVICE = os.getenv("RAIDIO_ALSA_OUTPUT", "plughw:USB,0")


def _generate_tone(
    freq: float,
    duration: float,
    volume: float = 0.3,
    wave_type: str = "sine",
    fade_out: float = 0.05,
) -> list[int]:
    """Genere des samples PCM int16 pour un ton pur."""
    n_samples = int(SAMPLE_RATE * duration)
    n_fade = int(SAMPLE_RATE * fade_out)
    samples: list[int] = []

    for i in range(n_samples):
        t = i / SAMPLE_RATE
        if wave_type == "square":
            val = 1.0 if math.sin(2 * math.pi * freq * t) >= 0 else -1.0
        else:  # sine
            val = math.sin(2 * math.pi * freq * t)

        # Fade-out en fin de bip pour eviter les clics
        if i >= n_samples - n_fade:
            fade = (n_samples - i) / n_fade
            val *= fade

        samples.append(int(val * volume * 32767))

    return samples


def _generate_silence(duration: float) -> list[int]:
    """Genere du silence (samples a zero)."""
    return [0] * int(SAMPLE_RATE * duration)


def generate_critical_sound() -> bytes:
    """
    Sirene deux-tons urgente : 800Hz / 600Hz alternes, 6 bips, onde carree.
    Duree totale ~1.8s.
    """
    samples: list[int] = []
    for i in range(6):
        freq = 800 if i % 2 == 0 else 600
        samples.extend(_generate_tone(freq, 0.25, volume=0.35, wave_type="square"))
        samples.extend(_generate_silence(0.05))
    return _samples_to_wav(samples)


def generate_warning_sound() -> bytes:
    """
    Triple bip doux : 660Hz sinusoidal, 3 bips.
    Duree totale ~1.2s.
    """
    samples: list[int] = []
    for _ in range(3):
        samples.extend(_generate_tone(660, 0.25, volume=0.25, wave_type="sine"))
        samples.extend(_generate_silence(0.15))
    return _samples_to_wav(samples)


def _samples_to_wav(samples: list[int]) -> bytes:
    """Emballe des samples int16 dans un WAV."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(BYTES_PER_SAMPLE)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    return buf.getvalue()


# Cache des WAV pre-generes (evite de recalculer a chaque alerte)
_sound_cache: dict[str, bytes] = {}
_playing_lock = threading.Lock()


def _get_sound(severity: str) -> bytes:
    """Retourne le WAV cache pour la severite donnee."""
    if severity not in _sound_cache:
        if severity == "critical":
            _sound_cache[severity] = generate_critical_sound()
        else:
            _sound_cache[severity] = generate_warning_sound()
    return _sound_cache[severity]


def play_alert(severity: str) -> None:
    """
    Joue le son d'alerte correspondant a la severite via aplay (ALSA).
    Non-bloquant : lance la lecture dans un thread separe.
    Ignore si une lecture est deja en cours.
    """
    if not _playing_lock.acquire(blocking=False):
        return  # Deja en cours de lecture

    def _play():
        try:
            wav_data = _get_sound(severity)
            proc = subprocess.Popen(
                ["aplay", "-q", "-D", ALSA_OUTPUT_DEVICE, "-"],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            proc.communicate(input=wav_data, timeout=10)
        except FileNotFoundError:
            print("[ALERT SOUND] aplay introuvable — son desactive")
        except subprocess.TimeoutExpired:
            proc.kill()  # type: ignore[possibly-undefined]
        except Exception as e:
            print(f"[ALERT SOUND] Erreur: {e}")
        finally:
            _playing_lock.release()

    thread = threading.Thread(target=_play, daemon=True)
    thread.start()


# Pre-generer les sons au chargement du module
def warmup():
    """Pre-genere les sons en cache."""
    _get_sound("critical")
    _get_sound("warning")
    print("[ALERT SOUND] Sons pre-generes (critical + warning)")
