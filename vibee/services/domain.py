from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


@dataclass(slots=True)
class DownloadedTrack:
    title: str
    uploader: str
    duration: float
    source_url: str
    webpage_url: str
    audio_path: Path


@dataclass(slots=True)
class SegmentDescriptor:
    index: int
    label: str
    start: float
    end: float
    start_bar: int
    end_bar: int
    bpm: float
    beat_stability: float
    beat_count: int
    bar_count: int
    phrase_bars: int
    key: str
    key_confidence: float
    loudness: float
    loudness_slope: float
    brightness: float
    onset_density: float
    percussiveness: float
    vocal_likelihood: float
    repetition_score: float
    intro_likelihood: float
    outro_likelihood: float
    chroma_vector: np.ndarray

    @property
    def duration(self) -> float:
        return self.end - self.start


@dataclass(slots=True)
class SongAnalysis:
    track: DownloadedTrack
    duration: float
    sample_rate: int
    audio: np.ndarray
    audio_offset: float
    beat_times: np.ndarray
    downbeat_times: np.ndarray
    bar_times: np.ndarray
    tempo: float
    analysis_engine: str
    segments: list[SegmentDescriptor]
    bar_chroma: np.ndarray
    bar_tonnetz: np.ndarray
    bar_rms: np.ndarray
    bar_brightness: np.ndarray
    bar_onset: np.ndarray
    bar_percussiveness: np.ndarray
    bar_vocal: np.ndarray
    bar_representation: np.ndarray
    profiling: dict[str, float]


@dataclass(slots=True)
class WindowDescriptor:
    start_bar: int
    end_bar: int
    start: float
    end: float
    bar_count: int
    bpm: float
    beat_stability: float
    key: str
    key_confidence: float
    loudness: float
    loudness_delta: float
    brightness: float
    onset_density: float
    percussiveness: float
    vocal_likelihood: float
    activity: float
    chroma_vector: np.ndarray
    tonnetz_vector: np.ndarray


@dataclass(slots=True)
class RankedCandidate:
    score: float
    source_segment: SegmentDescriptor
    target_segment: SegmentDescriptor
    source_window: WindowDescriptor
    target_window: WindowDescriptor
    transition_type: str
    components: dict[str, float]
    reasons: list[str] = field(default_factory=list)
