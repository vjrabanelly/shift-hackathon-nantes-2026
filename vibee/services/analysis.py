from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from time import perf_counter
from typing import Iterable

import librosa
import numpy as np
import soundfile as sf

import settings

from .domain import DownloadedTrack, SegmentDescriptor, SongAnalysis


KEY_NAMES = np.array(["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"])
KRUMHANSL_MAJOR = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
KRUMHANSL_MINOR = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return float(max(lower, min(upper, value)))


def safe_norm(values: np.ndarray) -> np.ndarray:
    total = float(np.linalg.norm(values))
    if total <= 1e-9:
        return np.zeros_like(values, dtype=np.float32)
    return (values / total).astype(np.float32)


class AudioAnalyzer:
    def __init__(self) -> None:
        self._cache: dict[str, SongAnalysis] = {}

    def analyze(self, track: DownloadedTrack, role: str = "generic") -> SongAnalysis:
        cache_key = f"{Path(track.audio_path).resolve()}::{role}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        profiling: dict[str, float] = {}
        started_at = perf_counter()

        load_started = perf_counter()
        y, sr, duration, region_offset = self._load_audio_region(track, role)
        profiling["load_audio"] = perf_counter() - load_started

        region_started = perf_counter()
        analysis_y = y
        profiling["region_prep"] = perf_counter() - region_started
        region_duration = float(len(analysis_y) / sr)

        beats_started = perf_counter()
        beat_times_local, downbeats_local, tempo = self._detect_beats(analysis_y, sr)
        profiling["beat_tracking"] = perf_counter() - beats_started

        bars_started = perf_counter()
        local_bar_times = self._build_bar_times(downbeats_local, beat_times_local, region_duration)
        beat_times = beat_times_local + region_offset
        downbeats = downbeats_local + region_offset
        bar_times = local_bar_times + region_offset
        profiling["bar_grid"] = perf_counter() - bars_started

        feature_started = perf_counter()
        bar_features = self._compute_bar_features(analysis_y, sr, local_bar_times)
        profiling["bar_features"] = perf_counter() - feature_started

        structure_started = perf_counter()
        segments = self._build_pycrossfade_segments(
            bar_times=bar_times,
            beat_times=beat_times,
            duration=duration,
            role=role,
            bar_chroma=bar_features["bar_chroma"],
            bar_rms=bar_features["bar_rms"],
            bar_brightness=bar_features["bar_brightness"],
            bar_onset=bar_features["bar_onset"],
            bar_percussiveness=bar_features["bar_percussiveness"],
            bar_vocal=bar_features["bar_vocal"],
        )
        profiling["segmentation"] = perf_counter() - structure_started

        repetition_started = perf_counter()
        segments = self._annotate_repetition(segments)
        profiling["repetition"] = perf_counter() - repetition_started
        profiling["total_analysis"] = perf_counter() - started_at

        analysis = SongAnalysis(
            track=track,
            duration=duration,
            sample_rate=sr,
            audio=y,
            audio_offset=region_offset,
            beat_times=beat_times,
            downbeat_times=downbeats,
            bar_times=bar_times,
            tempo=float(tempo),
            analysis_engine="librosa fast downbeats@11k + region reader + pyCrossfade window prep",
            segments=segments,
            bar_chroma=bar_features["bar_chroma"],
            bar_tonnetz=bar_features["bar_tonnetz"],
            bar_rms=bar_features["bar_rms"],
            bar_brightness=bar_features["bar_brightness"],
            bar_onset=bar_features["bar_onset"],
            bar_percussiveness=bar_features["bar_percussiveness"],
            bar_vocal=bar_features["bar_vocal"],
            bar_representation=bar_features["bar_representation"],
            profiling={name: round(value, 4) for name, value in profiling.items()},
        )
        self._cache[cache_key] = analysis
        return analysis

    def _region_bounds(self, duration: float, role: str) -> tuple[float, float]:
        if role == "source":
            seconds = min(duration, settings.SOURCE_ANALYSIS_SECONDS)
            start = max(0.0, duration - seconds)
            return start, duration
        if role == "target":
            seconds = min(duration, settings.TARGET_ANALYSIS_SECONDS)
            return 0.0, seconds
        return 0.0, duration

    def _load_audio_region(
        self,
        track: DownloadedTrack,
        role: str,
    ) -> tuple[np.ndarray, int, float, float]:
        info = sf.info(track.audio_path)
        native_sr = int(info.samplerate)
        duration = float(info.frames / native_sr) if info.frames and native_sr else float(track.duration or 0.0)
        start_time, end_time = self._region_bounds(duration, role)
        start_frame = max(0, int(start_time * native_sr))
        frame_count = max(1, int((end_time - start_time) * native_sr))

        with sf.SoundFile(track.audio_path) as audio_file:
            audio_file.seek(start_frame)
            data = audio_file.read(frames=frame_count, dtype="float32", always_2d=True)

        if data.size == 0:
            return np.zeros(1, dtype=np.float32), settings.SAMPLE_RATE, duration, start_time

        audio = np.mean(data, axis=1, dtype=np.float32)
        if native_sr != settings.SAMPLE_RATE:
            audio = librosa.resample(audio, orig_sr=native_sr, target_sr=settings.SAMPLE_RATE)
            sr = settings.SAMPLE_RATE
        else:
            sr = native_sr
        return audio.astype(np.float32), sr, duration, start_time

    def _detect_beats(
        self,
        y: np.ndarray,
        sr: int,
    ) -> tuple[np.ndarray, np.ndarray, float]:
        if sr != settings.BEAT_SAMPLE_RATE:
            beat_y = librosa.resample(y, orig_sr=sr, target_sr=settings.BEAT_SAMPLE_RATE)
            beat_sr = settings.BEAT_SAMPLE_RATE
        else:
            beat_y = y
            beat_sr = sr

        onset_env = librosa.onset.onset_strength(
            y=beat_y,
            sr=beat_sr,
            hop_length=settings.BEAT_HOP_LENGTH,
        )
        tempo, beat_frames = librosa.beat.beat_track(
            onset_envelope=onset_env,
            sr=beat_sr,
            hop_length=settings.BEAT_HOP_LENGTH,
            units="frames",
            trim=False,
        )
        tempo_value = float(np.asarray(tempo).reshape(-1)[0]) if np.size(tempo) else 0.0
        beat_times = librosa.frames_to_time(
            beat_frames,
            sr=beat_sr,
            hop_length=settings.BEAT_HOP_LENGTH,
        ).astype(np.float32)

        if len(beat_times) < settings.BEATS_PER_BAR:
            fallback_tempo = tempo_value if tempo_value > 0 else 120.0
            beat_interval = 60.0 / max(fallback_tempo, 1e-6)
            beat_times = np.arange(
                0.0,
                max(len(beat_y) / beat_sr, beat_interval),
                beat_interval,
                dtype=np.float32,
            )

        downbeats = beat_times[:: settings.BEATS_PER_BAR]
        if len(downbeats) < 2:
            downbeats = np.array([0.0, max(len(beat_y) / beat_sr, 0.5)], dtype=np.float32)

        return beat_times.astype(np.float32), downbeats.astype(np.float32), tempo_value

    def _build_bar_times(
        self,
        downbeats: np.ndarray,
        beat_times: np.ndarray,
        duration: float,
    ) -> np.ndarray:
        bars = np.unique(np.clip(downbeats.astype(np.float32), 0.0, duration))
        if len(bars) < 2:
            if len(beat_times) >= settings.BEATS_PER_BAR:
                bars = beat_times[:: settings.BEATS_PER_BAR]
            else:
                approx_bar = max(60.0 / 120.0 * settings.BEATS_PER_BAR, 2.0)
                bars = np.arange(0.0, duration + approx_bar, approx_bar, dtype=np.float32)

        if bars[0] > 0.01:
            bars = np.insert(bars, 0, 0.0)
        if duration - bars[-1] > 0.25:
            bars = np.append(bars, duration)
        elif bars[-1] != duration:
            bars[-1] = duration
        return bars.astype(np.float32)

    def _compute_bar_features(self, y: np.ndarray, sr: int, bar_times: np.ndarray) -> dict[str, np.ndarray]:
        if sr != settings.FEATURE_SAMPLE_RATE:
            feature_y = librosa.resample(y, orig_sr=sr, target_sr=settings.FEATURE_SAMPLE_RATE)
            feature_sr = settings.FEATURE_SAMPLE_RATE
        else:
            feature_y = y
            feature_sr = sr

        spectrum = np.abs(
            librosa.stft(
                feature_y,
                n_fft=settings.FEATURE_N_FFT,
                hop_length=settings.FEATURE_HOP_LENGTH,
            )
        ).astype(np.float32)

        chroma = librosa.feature.chroma_stft(
            S=spectrum,
            sr=feature_sr,
            n_fft=settings.FEATURE_N_FFT,
            hop_length=settings.FEATURE_HOP_LENGTH,
        )
        tonnetz = librosa.feature.tonnetz(chroma=chroma, sr=feature_sr)
        rms = librosa.feature.rms(S=spectrum)[0]
        centroid = librosa.feature.spectral_centroid(S=spectrum, sr=feature_sr)[0]
        flatness = librosa.feature.spectral_flatness(S=np.maximum(spectrum, 1e-6))[0]
        onset_env = librosa.onset.onset_strength(
            S=spectrum,
            sr=feature_sr,
            hop_length=settings.FEATURE_HOP_LENGTH,
        )
        vocal_curve = self._vocal_curve_from_spectrum(spectrum, feature_sr)
        percussive_curve = self._percussive_curve(onset_env, flatness)

        bar_chroma = self._aggregate_feature(
            chroma,
            feature_sr,
            bar_times,
            aggregate="median",
            normalize=True,
            hop_length=settings.FEATURE_HOP_LENGTH,
        )
        bar_tonnetz = self._aggregate_feature(
            tonnetz,
            feature_sr,
            bar_times,
            aggregate="mean",
            normalize=False,
            hop_length=settings.FEATURE_HOP_LENGTH,
        )
        bar_rms = self._aggregate_1d(rms, feature_sr, bar_times, aggregate="mean", hop_length=settings.FEATURE_HOP_LENGTH)
        bar_brightness = self._aggregate_1d(
            centroid / (feature_sr / 2.0),
            feature_sr,
            bar_times,
            aggregate="mean",
            hop_length=settings.FEATURE_HOP_LENGTH,
        )
        bar_onset = self._aggregate_1d(
            onset_env,
            feature_sr,
            bar_times,
            aggregate="mean",
            hop_length=settings.FEATURE_HOP_LENGTH,
        )
        bar_vocal = self._aggregate_1d(
            vocal_curve,
            feature_sr,
            bar_times,
            aggregate="mean",
            hop_length=settings.FEATURE_HOP_LENGTH,
        )
        bar_percussiveness = self._aggregate_1d(
            percussive_curve,
            feature_sr,
            bar_times,
            aggregate="mean",
            hop_length=settings.FEATURE_HOP_LENGTH,
        )

        rep = np.hstack(
            [
                bar_chroma,
                bar_tonnetz,
                bar_rms[:, None],
                bar_brightness[:, None],
                bar_onset[:, None],
                bar_percussiveness[:, None],
                bar_vocal[:, None],
            ]
        ).astype(np.float32)

        return {
            "bar_chroma": bar_chroma,
            "bar_tonnetz": bar_tonnetz.astype(np.float32),
            "bar_rms": bar_rms.astype(np.float32),
            "bar_brightness": bar_brightness.astype(np.float32),
            "bar_onset": bar_onset.astype(np.float32),
            "bar_percussiveness": bar_percussiveness.astype(np.float32),
            "bar_vocal": bar_vocal.astype(np.float32),
            "bar_representation": rep,
        }

    def _build_pycrossfade_segments(
        self,
        bar_times: np.ndarray,
        beat_times: np.ndarray,
        duration: float,
        role: str,
        bar_chroma: np.ndarray,
        bar_rms: np.ndarray,
        bar_brightness: np.ndarray,
        bar_onset: np.ndarray,
        bar_percussiveness: np.ndarray,
        bar_vocal: np.ndarray,
    ) -> list[SegmentDescriptor]:
        total_bars = max(0, len(bar_times) - 1)
        if total_bars <= 0:
            return []

        segment_bars = min(settings.PYCROSSFADE_SEGMENT_BARS, total_bars)
        boundaries = list(range(0, total_bars, segment_bars))
        if not boundaries or boundaries[-1] != total_bars:
            boundaries.append(total_bars)
        if len(boundaries) == 1:
            boundaries = [0, total_bars]

        segments: list[SegmentDescriptor] = []
        for index, (start_bar, end_bar) in enumerate(zip(boundaries[:-1], boundaries[1:])):
            descriptor = self._describe_segment(
                index=index,
                start_bar=start_bar,
                end_bar=end_bar,
                bar_times=bar_times,
                beat_times=beat_times,
                duration=duration,
                role=role,
                total_bars=total_bars,
                bar_chroma=bar_chroma,
                bar_rms=bar_rms,
                bar_brightness=bar_brightness,
                bar_onset=bar_onset,
                bar_percussiveness=bar_percussiveness,
                bar_vocal=bar_vocal,
            )
            if descriptor is not None:
                segments.append(descriptor)

        return segments

    def _describe_segment(
        self,
        index: int,
        start_bar: int,
        end_bar: int,
        bar_times: np.ndarray,
        beat_times: np.ndarray,
        duration: float,
        role: str,
        total_bars: int,
        bar_chroma: np.ndarray,
        bar_rms: np.ndarray,
        bar_brightness: np.ndarray,
        bar_onset: np.ndarray,
        bar_percussiveness: np.ndarray,
        bar_vocal: np.ndarray,
    ) -> SegmentDescriptor | None:
        if end_bar <= start_bar:
            return None

        start = float(bar_times[start_bar])
        end = float(bar_times[end_bar])
        if end - start < 4.0:
            return None

        bar_slice = slice(start_bar, end_bar)
        seg_beats = beat_times[(beat_times >= start) & (beat_times < end)]
        beat_count = int(len(seg_beats))
        bar_count = end_bar - start_bar
        phrase_bars = max(settings.BEATS_PER_BAR, round(bar_count / 4) * 4)
        chroma = safe_norm(np.mean(bar_chroma[bar_slice], axis=0))
        key, key_confidence = self.estimate_key(chroma)
        loudness_curve = bar_rms[bar_slice]
        onset_curve = bar_onset[bar_slice]
        percussive_curve = bar_percussiveness[bar_slice]
        vocal_curve = bar_vocal[bar_slice]
        loudness = float(np.mean(loudness_curve)) if len(loudness_curve) else 0.0
        loudness_slope = float(loudness_curve[-1] - loudness_curve[0]) if len(loudness_curve) > 1 else 0.0
        brightness = float(np.mean(bar_brightness[bar_slice])) if bar_count else 0.0
        onset_density = float(np.mean(onset_curve)) if len(onset_curve) else 0.0
        percussiveness = float(np.mean(percussive_curve)) if len(percussive_curve) else 0.0
        vocal_likelihood = float(np.mean(vocal_curve)) if len(vocal_curve) else 0.0
        position = (start + end) / 2.0 / max(duration, 1e-6)
        intro_likelihood, outro_likelihood = self._mixability_scores(
            loudness=loudness,
            loudness_slope=loudness_slope,
            onset_density=onset_density,
            vocal_likelihood=vocal_likelihood,
            position=position,
        )

        is_first_segment = start_bar == 0
        is_last_segment = end_bar >= total_bars
        if role == "target" and is_first_segment:
            label = "intro"
            intro_likelihood = max(intro_likelihood, 0.82)
        elif role == "source" and is_last_segment:
            label = "outro"
            outro_likelihood = max(outro_likelihood, 0.82)
        else:
            label = self._segment_label(
                position=position,
                loudness=loudness,
                onset_density=onset_density,
                percussiveness=percussiveness,
                intro_likelihood=intro_likelihood,
                outro_likelihood=outro_likelihood,
            )

        return SegmentDescriptor(
            index=index,
            label=label,
            start=start,
            end=end,
            start_bar=start_bar,
            end_bar=end_bar,
            bpm=self._local_tempo(seg_beats, start, end),
            beat_stability=self._beat_stability(seg_beats),
            beat_count=beat_count,
            bar_count=bar_count,
            phrase_bars=phrase_bars,
            key=key,
            key_confidence=key_confidence,
            loudness=loudness,
            loudness_slope=loudness_slope,
            brightness=brightness,
            onset_density=onset_density,
            percussiveness=percussiveness,
            vocal_likelihood=vocal_likelihood,
            repetition_score=0.0,
            intro_likelihood=intro_likelihood,
            outro_likelihood=outro_likelihood,
            chroma_vector=chroma,
        )

    def _annotate_repetition(
        self,
        segments: Iterable[SegmentDescriptor],
    ) -> list[SegmentDescriptor]:
        segment_list = list(segments)
        if len(segment_list) < 2:
            return segment_list

        vectors = np.vstack([safe_norm(segment.chroma_vector) for segment in segment_list])
        similarity = vectors @ vectors.T
        np.fill_diagonal(similarity, 0.0)
        scores = np.max(similarity, axis=1)
        updated = []
        for segment, score in zip(segment_list, scores):
            updated.append(replace(segment, repetition_score=clamp(float(score))))
        return updated

    def _aggregate_feature(
        self,
        feature: np.ndarray,
        sr: int,
        bar_times: np.ndarray,
        aggregate: str,
        normalize: bool,
        hop_length: int,
    ) -> np.ndarray:
        values = []
        times = librosa.frames_to_time(np.arange(feature.shape[1]), sr=sr, hop_length=hop_length)
        for start, end in zip(bar_times[:-1], bar_times[1:]):
            mask = (times >= start) & (times < end)
            window = feature[:, mask] if np.any(mask) else feature[:, :1]
            if aggregate == "median":
                vec = np.median(window, axis=1)
            else:
                vec = np.mean(window, axis=1)
            values.append(safe_norm(vec) if normalize else vec.astype(np.float32))
        return np.vstack(values).astype(np.float32)

    def _aggregate_1d(
        self,
        feature: np.ndarray,
        sr: int,
        bar_times: np.ndarray,
        aggregate: str,
        hop_length: int,
    ) -> np.ndarray:
        times = librosa.frames_to_time(np.arange(len(feature)), sr=sr, hop_length=hop_length)
        values = []
        for start, end in zip(bar_times[:-1], bar_times[1:]):
            mask = (times >= start) & (times < end)
            window = feature[mask] if np.any(mask) else feature[:1]
            if aggregate == "max":
                values.append(float(np.max(window)))
            else:
                values.append(float(np.mean(window)))
        return np.array(values, dtype=np.float32)

    def _vocal_curve_from_spectrum(self, spectrum: np.ndarray, sr: int) -> np.ndarray:
        if spectrum.size == 0:
            return np.zeros(1, dtype=np.float32)
        frequencies = librosa.fft_frequencies(sr=sr, n_fft=settings.FEATURE_N_FFT)
        speech_band = (frequencies >= 250) & (frequencies <= 3500)
        band_energy = np.sum(spectrum[speech_band], axis=0)
        total_energy = np.sum(spectrum, axis=0) + 1e-6
        return (band_energy / total_energy).astype(np.float32)

    def _percussive_curve(self, onset_env: np.ndarray, flatness: np.ndarray) -> np.ndarray:
        onset_norm = onset_env / max(float(np.max(onset_env)), 1e-6)
        flat_norm = flatness / max(float(np.max(flatness)), 1e-6)
        curve = 0.68 * onset_norm + 0.32 * flat_norm
        return np.clip(curve, 0.0, 1.0).astype(np.float32)

    def _local_tempo(self, beat_times: np.ndarray, start: float, end: float) -> float:
        if len(beat_times) > 1:
            return float(60.0 / np.median(np.diff(beat_times)))
        if end - start > 0:
            return float(settings.BEATS_PER_BAR * 60.0 / max((end - start) / 2.0, 1e-6))
        return 0.0

    def _beat_stability(self, beat_times: np.ndarray) -> float:
        if len(beat_times) < 3:
            return 0.35
        intervals = np.diff(beat_times)
        coefficient = float(np.std(intervals) / (np.mean(intervals) + 1e-6))
        return clamp(1.0 - coefficient * 2.0)

    def estimate_key(self, chroma_profile: np.ndarray) -> tuple[str, float]:
        major_scores = np.array(
            [
                np.corrcoef(chroma_profile, np.roll(KRUMHANSL_MAJOR, shift))[0, 1]
                for shift in range(12)
            ]
        )
        minor_scores = np.array(
            [
                np.corrcoef(chroma_profile, np.roll(KRUMHANSL_MINOR, shift))[0, 1]
                for shift in range(12)
            ]
        )
        major_scores = np.nan_to_num(major_scores)
        minor_scores = np.nan_to_num(minor_scores)
        best_major = int(np.argmax(major_scores))
        best_minor = int(np.argmax(minor_scores))
        top_major = float(major_scores[best_major])
        top_minor = float(minor_scores[best_minor])
        if top_major >= top_minor:
            key = f"{KEY_NAMES[best_major]} major"
            all_scores = np.concatenate([major_scores, minor_scores])
            confidence = top_major - float(np.partition(all_scores, -2)[-2])
            return key, clamp((confidence + 1.0) / 2.0)
        key = f"{KEY_NAMES[best_minor]} minor"
        all_scores = np.concatenate([major_scores, minor_scores])
        confidence = top_minor - float(np.partition(all_scores, -2)[-2])
        return key, clamp((confidence + 1.0) / 2.0)

    def _mixability_scores(
        self,
        loudness: float,
        loudness_slope: float,
        onset_density: float,
        vocal_likelihood: float,
        position: float,
    ) -> tuple[float, float]:
        sparsity = clamp(1.0 - onset_density / 6.0)
        quietness = clamp(1.0 - loudness * 5.0)
        intro = clamp(
            0.35 * sparsity
            + 0.2 * quietness
            + 0.2 * clamp(loudness_slope * 8.0 + 0.5)
            + 0.15 * (1.0 - vocal_likelihood)
            + 0.1 * clamp(1.0 - position * 1.8)
        )
        outro = clamp(
            0.35 * sparsity
            + 0.2 * quietness
            + 0.2 * clamp(-loudness_slope * 8.0 + 0.5)
            + 0.15 * (1.0 - vocal_likelihood)
            + 0.1 * clamp((position - 0.45) * 1.8)
        )
        return intro, outro

    def _segment_label(
        self,
        position: float,
        loudness: float,
        onset_density: float,
        percussiveness: float,
        intro_likelihood: float,
        outro_likelihood: float,
    ) -> str:
        if position < 0.2 and intro_likelihood > 0.55:
            return "intro"
        if position > 0.8 and outro_likelihood > 0.55:
            return "outro"
        if loudness > 0.12 and onset_density > 3.0 and percussiveness > 0.7:
            return "drop"
        if loudness < 0.08 and onset_density < 1.5:
            return "breakdown"
        return "section"
