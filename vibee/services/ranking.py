from __future__ import annotations

import math

import numpy as np

import settings

from .analysis import KEY_NAMES, AudioAnalyzer, clamp, safe_norm
from .domain import RankedCandidate, SegmentDescriptor, SongAnalysis, WindowDescriptor


def semitone_from_key(key: str) -> tuple[int, str]:
    tonic, mode = key.split(" ")
    index = int(list(KEY_NAMES).index(tonic))
    return index, mode


class TransitionRanker:
    def __init__(self, analyzer: AudioAnalyzer) -> None:
        self.analyzer = analyzer

    def rank(self, source: SongAnalysis, target: SongAnalysis) -> list[RankedCandidate]:
        source_windows = self._build_windows(source, role="source")
        target_windows = self._build_windows(target, role="target")
        ranked: list[RankedCandidate] = []

        for source_segment, source_window in source_windows:
            for target_segment, target_window in target_windows:
                if not self._passes_tempo_gate(source_window, target_window):
                    continue

                harmony = self._window_harmony_score(source_window, target_window)
                if harmony < 0.35:
                    continue

                rhythm = self._rhythm_score(source_window, target_window)
                energy = self._energy_score(source_window, target_window)
                timbre = self._timbre_score(source_window, target_window)
                arrangement = self._arrangement_score(source_segment, target_segment, source_window, target_window)
                stem_penalty = clamp(source_window.vocal_likelihood * target_window.vocal_likelihood * 1.3)
                silence_penalty = clamp(
                    max(0.0, 0.45 - target_window.activity) * 1.0
                    + max(0.0, 0.5 - source_window.activity) * 0.6
                )
                overlap_score = self._simulated_overlap_score(source_window, target_window)

                total = clamp(
                    0.21 * rhythm
                    + 0.2 * harmony
                    + 0.16 * energy
                    + 0.11 * timbre
                    + 0.16 * arrangement
                    + 0.16 * overlap_score
                    - 0.18 * stem_penalty
                    - 0.12 * silence_penalty
                )
                if total < 0.42:
                    continue

                transition_type = self._transition_type(source_window, target_window, overlap_score)
                ranked.append(
                    RankedCandidate(
                        score=total,
                        source_segment=source_segment,
                        target_segment=target_segment,
                        source_window=source_window,
                        target_window=target_window,
                        transition_type=transition_type,
                        components={
                            "rhythm": rhythm,
                            "harmony": harmony,
                            "energy": energy,
                            "timbre": timbre,
                            "arrangement": arrangement,
                            "overlap_quality": overlap_score,
                            "stem_conflict_penalty": stem_penalty,
                            "source_activity": source_window.activity,
                            "target_activity": target_window.activity,
                            "silence_penalty": silence_penalty,
                        },
                        reasons=self._reasons(
                            source_window,
                            target_window,
                            harmony,
                            overlap_score,
                            stem_penalty,
                            silence_penalty,
                        ),
                    )
                )

        ranked.sort(key=lambda item: item.score, reverse=True)
        return ranked

    def _build_windows(
        self,
        analysis: SongAnalysis,
        role: str,
    ) -> list[tuple[SegmentDescriptor, WindowDescriptor]]:
        scored: list[tuple[float, SegmentDescriptor, WindowDescriptor]] = []

        for segment in analysis.segments:
            if role == "source" and segment.end < analysis.duration * 0.3:
                continue
            if role == "target" and segment.start > analysis.duration * 0.7:
                continue

            segment_bar_count = max(1, segment.end_bar - segment.start_bar)
            for window_bars in settings.WINDOW_BAR_OPTIONS:
                if segment_bar_count < window_bars:
                    continue
                max_start = segment.end_bar - window_bars
                start_candidates = list(
                    range(segment.start_bar, max_start + 1, settings.WINDOW_BAR_STEP)
                )
                if start_candidates and start_candidates[-1] != max_start:
                    start_candidates.append(max_start)

                for start_bar in start_candidates:
                    end_bar = start_bar + window_bars
                    window = self._window_descriptor(analysis, start_bar, end_bar)
                    focus = self._window_focus_score(segment, window, role)
                    scored.append((focus, segment, window))

        scored.sort(key=lambda item: item[0], reverse=True)
        trimmed = scored[: settings.MAX_WINDOWS_PER_TRACK]
        return [(segment, window) for _, segment, window in trimmed]

    def _window_descriptor(
        self,
        analysis: SongAnalysis,
        start_bar: int,
        end_bar: int,
    ) -> WindowDescriptor:
        start = float(analysis.bar_times[start_bar])
        end = float(analysis.bar_times[end_bar])
        bar_slice = slice(start_bar, end_bar)
        chroma = safe_norm(np.mean(analysis.bar_chroma[bar_slice], axis=0))
        tonnetz = np.mean(analysis.bar_tonnetz[bar_slice], axis=0).astype(np.float32)
        rms_curve = analysis.bar_rms[bar_slice]
        onset_curve = analysis.bar_onset[bar_slice]
        percussive_curve = analysis.bar_percussiveness[bar_slice]
        vocal_curve = analysis.bar_vocal[bar_slice]

        key, key_confidence = self.analyzer.estimate_key(chroma)
        beat_times = analysis.beat_times[(analysis.beat_times >= start) & (analysis.beat_times < end)]
        bpm = float(60.0 / np.median(np.diff(beat_times))) if len(beat_times) > 1 else analysis.tempo
        beat_stability = self._beat_stability(beat_times)
        loudness = float(np.mean(rms_curve)) if len(rms_curve) else 0.0
        loudness_delta = float(rms_curve[-1] - rms_curve[0]) if len(rms_curve) > 1 else 0.0
        brightness = float(np.mean(analysis.bar_brightness[bar_slice])) if end_bar > start_bar else 0.0
        onset_density = float(np.mean(onset_curve))
        percussiveness = float(np.mean(percussive_curve))
        vocal_likelihood = float(np.mean(vocal_curve))
        activity = clamp(
            0.46 * clamp(loudness / 0.11)
            + 0.22 * clamp(onset_density / 2.5)
            + 0.2 * clamp(percussiveness / 0.8)
            + 0.12 * clamp(1.0 - vocal_likelihood)
        )

        return WindowDescriptor(
            start_bar=start_bar,
            end_bar=end_bar,
            start=start,
            end=end,
            bar_count=end_bar - start_bar,
            bpm=float(bpm),
            beat_stability=beat_stability,
            key=key,
            key_confidence=key_confidence,
            loudness=loudness,
            loudness_delta=loudness_delta,
            brightness=brightness,
            onset_density=onset_density,
            percussiveness=percussiveness,
            vocal_likelihood=vocal_likelihood,
            activity=activity,
            chroma_vector=chroma,
            tonnetz_vector=tonnetz,
        )

    def _window_focus_score(
        self,
        segment: SegmentDescriptor,
        window: WindowDescriptor,
        role: str,
    ) -> float:
        segment_span = max(1, segment.end_bar - segment.start_bar)
        center = (window.start_bar + window.end_bar) / 2.0
        segment_center = (segment.start_bar + segment.end_bar) / 2.0
        normalized_center = abs(center - segment_center) / segment_span
        position_score = 1.0 - normalized_center
        if role == "source":
            edge_bias = clamp((window.end_bar - segment.start_bar) / segment_span)
            return 0.34 * window.activity + 0.24 * edge_bias + 0.18 * position_score + 0.24 * segment.outro_likelihood
        edge_bias = clamp((segment.end_bar - window.start_bar) / segment_span)
        return 0.38 * window.activity + 0.22 * edge_bias + 0.16 * position_score + 0.24 * segment.intro_likelihood

    def _passes_tempo_gate(self, source_window: WindowDescriptor, target_window: WindowDescriptor) -> bool:
        bpm_gap = abs(source_window.bpm - target_window.bpm)
        stretch_ratio = max(source_window.bpm, target_window.bpm) / max(
            min(source_window.bpm, target_window.bpm),
            1e-6,
        )
        return not (bpm_gap > 12.0 and stretch_ratio > settings.MAX_BPM_STRETCH_RATIO)

    def _window_harmony_score(self, source_window: WindowDescriptor, target_window: WindowDescriptor) -> float:
        key_score = self._key_compatibility(source_window.key, target_window.key)
        chroma_score = float(np.dot(source_window.chroma_vector, target_window.chroma_vector))
        tonnetz_distance = float(np.linalg.norm(source_window.tonnetz_vector - target_window.tonnetz_vector))
        tonnetz_score = clamp(1.0 - tonnetz_distance / 3.5)
        confidence = math.sqrt(source_window.key_confidence * target_window.key_confidence)
        return clamp(0.38 * key_score + 0.37 * chroma_score + 0.15 * tonnetz_score + 0.1 * confidence)

    def _rhythm_score(self, source_window: WindowDescriptor, target_window: WindowDescriptor) -> float:
        bpm_gap = abs(source_window.bpm - target_window.bpm)
        phrase_score = clamp(1.0 - abs(source_window.bar_count - target_window.bar_count) / max(source_window.bar_count, target_window.bar_count, 1))
        return clamp(
            0.48 * clamp(1.0 - bpm_gap / 8.0)
            + 0.22 * min(source_window.beat_stability, target_window.beat_stability)
            + 0.3 * phrase_score
        )

    def _energy_score(self, source_window: WindowDescriptor, target_window: WindowDescriptor) -> float:
        level_match = clamp(1.0 - abs(source_window.loudness - target_window.loudness) / 0.08)
        handoff_shape = clamp(1.0 - abs(source_window.loudness_delta + target_window.loudness_delta) / 0.16)
        return clamp(0.55 * level_match + 0.45 * handoff_shape)

    def _timbre_score(self, source_window: WindowDescriptor, target_window: WindowDescriptor) -> float:
        brightness = clamp(1.0 - abs(source_window.brightness - target_window.brightness) / 0.35)
        percussion = clamp(1.0 - abs(source_window.percussiveness - target_window.percussiveness) / 0.8)
        return clamp(0.55 * brightness + 0.45 * percussion)

    def _arrangement_score(
        self,
        source_segment: SegmentDescriptor,
        target_segment: SegmentDescriptor,
        source_window: WindowDescriptor,
        target_window: WindowDescriptor,
    ) -> float:
        return clamp(
            0.28 * source_segment.outro_likelihood
            + 0.24 * target_segment.intro_likelihood
            + 0.22 * source_window.activity
            + 0.18 * target_window.activity
            + 0.08 * clamp(1.0 - source_window.vocal_likelihood * target_window.vocal_likelihood)
        )

    def _simulated_overlap_score(self, source_window: WindowDescriptor, target_window: WindowDescriptor) -> float:
        bars = min(source_window.bar_count, target_window.bar_count)
        fade = np.linspace(1.0, 0.0, bars, dtype=np.float32)
        incoming = np.linspace(0.0, 1.0, bars, dtype=np.float32)

        source_energy = np.linspace(
            source_window.loudness,
            source_window.loudness + source_window.loudness_delta,
            bars,
            dtype=np.float32,
        )
        target_energy = np.linspace(
            target_window.loudness - target_window.loudness_delta,
            target_window.loudness,
            bars,
            dtype=np.float32,
        )
        mixed_energy = source_energy * fade + target_energy * incoming
        floor_score = clamp(float(np.min(mixed_energy)) / max(0.04, float(np.max(mixed_energy)) + 1e-6))
        continuity = clamp(1.0 - float(np.std(np.diff(mixed_energy))) / 0.04)
        onset_match = clamp(1.0 - abs(source_window.onset_density - target_window.onset_density) / 2.8)
        vocal_safety = clamp(1.0 - source_window.vocal_likelihood * target_window.vocal_likelihood)
        return clamp(0.32 * floor_score + 0.28 * continuity + 0.2 * onset_match + 0.2 * vocal_safety)

    def _transition_type(
        self,
        source_window: WindowDescriptor,
        target_window: WindowDescriptor,
        overlap_score: float,
    ) -> str:
        if source_window.vocal_likelihood * target_window.vocal_likelihood > 0.35:
            return "echo_freeze"
        if overlap_score > 0.72 and source_window.activity > 0.55 and target_window.activity > 0.55:
            return "beatmatched_crossfade"
        if source_window.percussiveness > 0.65 and target_window.percussiveness > 0.65:
            return "drum_overlap"
        return "filter_swap"

    def _reasons(
        self,
        source_window: WindowDescriptor,
        target_window: WindowDescriptor,
        harmony: float,
        overlap_score: float,
        stem_penalty: float,
        silence_penalty: float,
    ) -> list[str]:
        reasons = [
            f"Bar window {source_window.bar_count} -> {target_window.bar_count} bars with strong harmonic fit {harmony:.2f}.",
            f"Simulated overlap quality scores {overlap_score:.2f} before rendering.",
            f"Incoming activity {target_window.activity:.2f}; silence penalty {silence_penalty:.2f}.",
        ]
        if stem_penalty < 0.2:
            reasons.append("Estimated vocal conflict is low enough for a direct overlap.")
        else:
            reasons.append("Vocal overlap still looks busy, so a protected transition style is preferred.")
        return reasons

    def _key_compatibility(self, source_key: str, target_key: str) -> float:
        source_pitch, source_mode = semitone_from_key(source_key)
        target_pitch, target_mode = semitone_from_key(target_key)
        distance = min((source_pitch - target_pitch) % 12, (target_pitch - source_pitch) % 12)
        if source_pitch == target_pitch and source_mode == target_mode:
            return 1.0
        if source_pitch == target_pitch and source_mode != target_mode:
            return 0.9
        if distance in {5, 7}:
            return 0.82
        if distance in {2, 10}:
            return 0.64
        return max(0.12, 1.0 - distance / 8.0)

    def _beat_stability(self, beat_times: np.ndarray) -> float:
        if len(beat_times) < 3:
            return 0.35
        intervals = np.diff(beat_times)
        coefficient = float(np.std(intervals) / (np.mean(intervals) + 1e-6))
        return clamp(1.0 - coefficient * 2.0)
