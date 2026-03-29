from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter

import settings

from .domain import RankedCandidate, SongAnalysis


@dataclass(slots=True)
class BarSong:
    audio: np.ndarray
    downbeats: np.ndarray
    sample_rate: int


class TransitionRenderer:
    """Modern pyCrossfade-style renderer used as the single transition solution."""

    def __init__(self, preview_dir: Path) -> None:
        self.preview_dir = preview_dir

    def render_preview(
        self,
        candidate: RankedCandidate,
        source: SongAnalysis,
        target: SongAnalysis,
    ) -> Path:
        len_crossfade = min(8, candidate.source_window.bar_count, candidate.target_window.bar_count)
        len_time_stretch = min(8, max(1, candidate.source_window.end_bar))

        master_end_bar = candidate.source_window.end_bar
        master_start_bar = max(0, master_end_bar - (len_crossfade + len_time_stretch))
        slave_start_bar = candidate.target_window.start_bar
        slave_end_bar = min(len(target.bar_times) - 1, slave_start_bar + len_crossfade + 8)

        master_song = self._build_song_clip(source, master_start_bar, master_end_bar)
        slave_song = self._build_song_clip(target, slave_start_bar, slave_end_bar)
        rendered = self._crossfade(master_song, slave_song, len_crossfade=len_crossfade, len_time_stretch=len_time_stretch)
        preview = self._normalize(rendered["audio"])
        preview = self._apply_preview_envelope(preview)
        return self._write_preview(preview, source.sample_rate)

    def _write_preview(self, audio: np.ndarray, sr: int) -> Path:
        filename = self.preview_dir / f"{uuid4().hex}.wav"
        sf.write(filename, audio, sr)
        return filename

    def _slice_audio(self, analysis: SongAnalysis, start: float, end: float) -> np.ndarray:
        local_start = max(0.0, start - analysis.audio_offset)
        local_end = max(local_start, end - analysis.audio_offset)
        start_sample = max(0, int(local_start * analysis.sample_rate))
        end_sample = min(len(analysis.audio), int(local_end * analysis.sample_rate))
        return analysis.audio[start_sample:end_sample]

    def _fit_length(self, audio: np.ndarray, length: int) -> np.ndarray:
        if len(audio) == length:
            return audio
        if len(audio) > length:
            return audio[:length]
        return np.pad(audio, (0, length - len(audio)))

    def _normalize(self, audio: np.ndarray) -> np.ndarray:
        peak = float(np.max(np.abs(audio))) if len(audio) else 1.0
        return audio / max(peak, 1.0)

    def _apply_preview_envelope(self, audio: np.ndarray) -> np.ndarray:
        if len(audio) < 4:
            return audio
        fade_samples = min(len(audio) // 8, int(settings.SAMPLE_RATE * 0.08))
        if fade_samples <= 1:
            return audio
        envelope = np.ones(len(audio), dtype=np.float32)
        envelope[:fade_samples] = np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
        envelope[-fade_samples:] = np.linspace(1.0, 0.0, fade_samples, dtype=np.float32)
        return audio * envelope

    def _mix_overlap(
        self,
        outgoing: np.ndarray,
        incoming: np.ndarray,
        sr: int,
    ) -> np.ndarray:
        fade = np.linspace(0.0, 1.0, len(outgoing), dtype=np.float32)
        eq_out = np.cos(fade * np.pi / 2.0)
        eq_in = np.sin(fade * np.pi / 2.0)
        return outgoing * (0.92 * eq_out + 0.08) + incoming * (0.95 * eq_in + 0.05)

    def _build_song_clip(self, analysis: SongAnalysis, start_bar: int, end_bar: int) -> BarSong:
        start = float(analysis.bar_times[start_bar])
        end = float(analysis.bar_times[end_bar])
        audio = self._slice_audio(analysis, start, end)
        local_downbeats = (
            (analysis.bar_times[start_bar:end_bar] - analysis.bar_times[start_bar]) * analysis.sample_rate
        ).astype(int)
        return BarSong(audio=audio.astype(np.float32), downbeats=local_downbeats, sample_rate=analysis.sample_rate)

    def _crop_audio_and_dbeats(self, song: BarSong, start_dbeat: int, end_dbeat: int) -> BarSong:
        dbeats = song.downbeats
        total = len(dbeats)
        if start_dbeat < 0:
            start_dbeat = total + start_dbeat
        if end_dbeat < 0:
            end_dbeat = total + end_dbeat
        if start_dbeat >= total or end_dbeat >= total or start_dbeat >= end_dbeat:
            raise ValueError("Invalid crop indices for pyCrossfade workflow.")

        start_idx = int(dbeats[start_dbeat])
        end_idx = int(dbeats[end_dbeat])
        cropped_audio = song.audio[start_idx:end_idx]
        cropped_dbeats = dbeats[start_dbeat:end_dbeat] - start_idx
        return BarSong(audio=cropped_audio, downbeats=cropped_dbeats, sample_rate=song.sample_rate)

    def _time_stretch(self, audio: np.ndarray, factor: float) -> np.ndarray:
        if len(audio) < 8 or abs(factor - 1.0) < 1e-3:
            return audio
        return librosa.effects.time_stretch(audio, rate=float(max(0.75, min(1.33, factor))))

    def _time_stretch_gradually_in_downbeats(self, song: BarSong, final_factor: float) -> np.ndarray:
        audio = song.audio
        dbeats = song.downbeats
        if abs(final_factor - 1.0) < 1e-3 or len(dbeats) < 2:
            return audio

        step = (final_factor - 1.0) / max(1, len(dbeats) - 1)
        factors = np.arange(1.0, final_factor, step, dtype=np.float32)[1:]
        fragments = []
        for index, factor in enumerate(factors):
            current = int(dbeats[index])
            nxt = int(dbeats[index + 1])
            fragments.append(self._time_stretch(audio[current:nxt], float(factor)))
        fragments.append(audio[int(dbeats[-1]) :])
        return np.concatenate(fragments) if fragments else audio

    def _beatmatch_to_slave(self, master_song: BarSong, slave_song: BarSong) -> tuple[np.ndarray, np.ndarray]:
        master_audio = master_song.audio
        master_dbeats = master_song.downbeats
        slave_audio = slave_song.audio
        slave_dbeats = slave_song.downbeats

        if len(master_dbeats) != len(slave_dbeats):
            raise ValueError("master/slave downbeat lengths must match in pyCrossfade workflow.")

        fragments = []
        for i in range(len(master_dbeats) - 1):
            master_cur, master_next = int(master_dbeats[i]), int(master_dbeats[i + 1])
            slave_cur, slave_next = int(slave_dbeats[i]), int(slave_dbeats[i + 1])
            master_diff = max(1, master_next - master_cur)
            slave_diff = max(1, slave_next - slave_cur)
            ts_factor = master_diff / slave_diff
            ts_master = self._time_stretch(master_audio[master_cur:master_next], ts_factor)
            fragments.append(self._fit_length(ts_master, slave_diff))

        master_cur, master_next = int(master_dbeats[-1]), len(master_audio)
        slave_cur, slave_next = int(slave_dbeats[-1]), len(slave_audio)
        master_diff = max(1, master_next - master_cur)
        slave_diff = max(1, slave_next - slave_cur)
        ts_factor = master_diff / slave_diff
        ts_master = self._time_stretch(master_audio[master_cur:master_next], ts_factor)
        fragments.append(self._fit_length(ts_master, slave_diff))
        return np.concatenate(fragments), slave_audio

    def _linear_fade_volume(self, audio: np.ndarray, start_volume: float, end_volume: float) -> np.ndarray:
        if start_volume == end_volume:
            return audio
        profile = np.sqrt(np.linspace(start_volume, end_volume, len(audio), dtype=np.float32))
        return audio * profile

    def _shelf_biquad(self, sr: int, freq: float, gain_db: float, shelf_type: str) -> tuple[np.ndarray, np.ndarray]:
        a = 10 ** (gain_db / 40.0)
        w0 = 2.0 * np.pi * freq / sr
        cos_w0 = np.cos(w0)
        sin_w0 = np.sin(w0)
        alpha = sin_w0 / 2.0 * np.sqrt((a + 1.0 / a) * 2.0)
        beta = 2.0 * np.sqrt(a) * alpha

        if shelf_type == "low_shelf":
            b0 = a * ((a + 1) - (a - 1) * cos_w0 + beta)
            b1 = 2 * a * ((a - 1) - (a + 1) * cos_w0)
            b2 = a * ((a + 1) - (a - 1) * cos_w0 - beta)
            a0 = (a + 1) + (a - 1) * cos_w0 + beta
            a1 = -2 * ((a - 1) + (a + 1) * cos_w0)
            a2 = (a + 1) + (a - 1) * cos_w0 - beta
        else:
            b0 = a * ((a + 1) + (a - 1) * cos_w0 + beta)
            b1 = -2 * a * ((a - 1) + (a + 1) * cos_w0)
            b2 = a * ((a + 1) + (a - 1) * cos_w0 - beta)
            a0 = (a + 1) - (a - 1) * cos_w0 + beta
            a1 = 2 * ((a - 1) - (a + 1) * cos_w0)
            a2 = (a + 1) - (a - 1) * cos_w0 - beta

        b = np.array([b0, b1, b2], dtype=np.float32) / a0
        a_coeff = np.array([1.0, a1 / a0, a2 / a0], dtype=np.float32)
        return b, a_coeff

    def _linear_fade_filter(
        self,
        audio: np.ndarray,
        filter_type: str,
        start_volume: float,
        end_volume: float,
        sr: int,
    ) -> np.ndarray:
        if start_volume == end_volume or len(audio) == 0:
            return audio

        num_steps = 20
        output = np.zeros_like(audio)
        profile = np.linspace(start_volume, end_volume, num_steps, dtype=np.float32)
        for i in range(num_steps):
            start_idx = int((i / float(num_steps)) * len(audio))
            end_idx = int(((i + 1) / float(num_steps)) * len(audio))
            chunk = audio[start_idx:end_idx]
            attenuation_db = -26.0 * (1.0 - float(profile[i]))
            if filter_type == "low_shelf":
                b, a = self._shelf_biquad(sr, 70.0, attenuation_db, "low_shelf")
            elif filter_type == "high_shelf":
                b, a = self._shelf_biquad(sr, 13000.0 if sr >= 32000 else sr * 0.28, attenuation_db, "high_shelf")
            else:
                output[start_idx:end_idx] = chunk
                continue
            output[start_idx:end_idx] = lfilter(b, a, chunk).astype(np.float32)
        return output

    def _crossfade(self, master_song: BarSong, slave_song: BarSong, len_crossfade: int, len_time_stretch: int) -> dict:
        master_audio = master_song.audio
        master_dbeats = master_song.downbeats
        slave_audio = slave_song.audio
        slave_dbeats = slave_song.downbeats

        if len(master_dbeats) < len_crossfade + len_time_stretch + 1 or len(slave_dbeats) < len_crossfade + 1:
            overlap = min(len(master_audio), len(slave_audio))
            mixed = self._mix_overlap(master_audio[-overlap:], slave_audio[:overlap], master_song.sample_rate)
            return {"audio": np.concatenate([master_audio[:-overlap], mixed, slave_audio[overlap:]])}

        crossfade_master_first_diff = master_dbeats[(-1 * len_crossfade) + 1] - master_dbeats[-1 * len_crossfade]
        crossfade_slave_first_diff = slave_dbeats[1] - slave_dbeats[0]
        ts_final_factor = crossfade_master_first_diff / max(crossfade_slave_first_diff, 1)

        ts_dbeat_start = -1 * (len_crossfade + len_time_stretch)
        ts_dbeat_end = (-1 * len_crossfade) + 1
        ts_cropped_song = self._crop_audio_and_dbeats(master_song, ts_dbeat_start, ts_dbeat_end)
        time_stretch_audio = self._time_stretch_gradually_in_downbeats(ts_cropped_song, ts_final_factor)
        ts_start_idx = int(master_dbeats[ts_dbeat_start])

        master_fadeout_cropped_song = self._crop_audio_and_dbeats(
            master_song,
            len(master_dbeats) - len_crossfade - 1,
            len(master_dbeats) - 1,
        )
        slave_fadein_cropped_song = self._crop_audio_and_dbeats(slave_song, 0, len_crossfade)
        master_fadeout_audio, slave_fadein_audio = self._beatmatch_to_slave(
            master_fadeout_cropped_song,
            slave_fadein_cropped_song,
        )

        new_master_fadedout = self._linear_fade_volume(master_fadeout_audio, start_volume=0.9, end_volume=0.0)
        new_master_fadedout = self._linear_fade_filter(
            new_master_fadedout,
            "low_shelf",
            start_volume=0.9,
            end_volume=0.0,
            sr=master_song.sample_rate,
        )
        new_master_fadedout = self._linear_fade_filter(
            new_master_fadedout,
            "high_shelf",
            start_volume=0.9,
            end_volume=0.0,
            sr=master_song.sample_rate,
        )

        new_slave_fadedin = self._linear_fade_volume(slave_fadein_audio, start_volume=0.1, end_volume=1.0)
        new_slave_fadedin = self._linear_fade_filter(
            new_slave_fadedin,
            "low_shelf",
            start_volume=0.0,
            end_volume=1.0,
            sr=slave_song.sample_rate,
        )
        new_slave_fadedin = self._linear_fade_filter(
            new_slave_fadedin,
            "high_shelf",
            start_volume=0.0,
            end_volume=1.0,
            sr=slave_song.sample_rate,
        )

        crossfade_part_audio = new_slave_fadedin + new_master_fadedout
        slave_fadein_end_idx = int(slave_dbeats[0]) + len(new_slave_fadedin)
        result = np.concatenate(
            [
                master_song.audio[:ts_start_idx],
                time_stretch_audio,
                crossfade_part_audio,
                slave_song.audio[slave_fadein_end_idx:],
            ]
        )
        return {"audio": result}
