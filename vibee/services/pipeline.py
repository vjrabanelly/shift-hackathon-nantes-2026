from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from collections.abc import Callable
from threading import Lock
from time import perf_counter

import settings

from .analysis import AudioAnalyzer
from .domain import RankedCandidate, SongAnalysis
from .downloader import AudioDownloader
from .ranking import TransitionRanker
from .rendering import TransitionRenderer


class TransitionPipeline:
    def __init__(self) -> None:
        self.downloader = AudioDownloader(settings.DOWNLOAD_DIR)
        self.analyzer = AudioAnalyzer()
        self.ranker = TransitionRanker(self.analyzer)
        self.renderer = TransitionRenderer(settings.PREVIEW_DIR)

    def build_transition_set(
        self,
        source_url: str,
        target_url: str,
        progress_callback: Callable[[dict], None] | None = None,
    ) -> dict:
        timings: dict[str, float] = {}
        total_started = perf_counter()
        self._emit(progress_callback, 0.02, "Preparing transition job.", "queued")

        source_track, target_track, download_timings = self._download_tracks_in_parallel(
            source_url,
            target_url,
            progress_callback,
        )
        timings.update(download_timings)

        self._emit(progress_callback, 0.68, "Analyzing both tracks in parallel.", "analyzing")
        analyze_started = perf_counter()
        with ThreadPoolExecutor(max_workers=2) as executor:
            source_future = executor.submit(self.analyzer.analyze, source_track, "source")
            target_future = executor.submit(self.analyzer.analyze, target_track, "target")
            source_analysis = source_future.result()
            timings["analyze_source"] = round(source_analysis.profiling.get("total_analysis", 0.0), 4)
            self._emit(progress_callback, 0.8, "Incoming analysis still running.", "analyzing")
            target_analysis = target_future.result()
            timings["analyze_target"] = round(target_analysis.profiling.get("total_analysis", 0.0), 4)
        timings["analyze_wall"] = round(perf_counter() - analyze_started, 4)

        self._emit(progress_callback, 0.9, "Ranking the best transition candidates.", "ranking")
        started = perf_counter()
        candidates = self.ranker.rank(source_analysis, target_analysis)
        timings["ranking"] = round(perf_counter() - started, 4)
        top_candidates = candidates[: settings.PREVIEW_COUNT]
        rendered_candidates = []
        render_total = 0.0
        for index, candidate in enumerate(top_candidates, start=1):
            render_progress = 0.9 + 0.09 * (index / max(len(top_candidates), 1))
            self._emit(
                progress_callback,
                render_progress,
                f"Rendering preview {index} of {len(top_candidates)}.",
                "rendering",
            )
            started = perf_counter()
            preview_path = self.renderer.render_preview(candidate, source_analysis, target_analysis)
            render_time = perf_counter() - started

            rendered_candidates.append(
                self._candidate_payload(
                    candidate,
                    preview_path,
                    render_time,
                )
            )
            render_total += render_time
        timings["render_previews"] = round(render_total, 4)
        timings["total"] = round(perf_counter() - total_started, 4)

        result = {
            "engine": {
                "rhythm": source_analysis.analysis_engine,
                "structure": "pyCrossfade-aligned head/tail window preparation",
                "renderer": "modern pyCrossfade workflow",
            },
            "profiling": {
                "pipeline": timings,
                "source_analysis": source_analysis.profiling,
                "target_analysis": target_analysis.profiling,
            },
            "source_track": self._track_payload(source_analysis),
            "target_track": self._track_payload(target_analysis),
            "candidates": rendered_candidates,
        }
        self._emit(
            progress_callback,
            1.0,
            f"Finished in {timings['total']:.1f}s. Transition previews are ready.",
            "completed",
            timings=result["profiling"],
        )
        return result

    def _track_payload(self, analysis: SongAnalysis) -> dict:
        return {
            "title": analysis.track.title,
            "uploader": analysis.track.uploader,
            "duration": analysis.duration,
            "tempo": analysis.tempo,
            "analysis_engine": analysis.analysis_engine,
            "segment_count": len(analysis.segments),
        }

    def _candidate_payload(
        self,
        candidate: RankedCandidate,
        preview_path,
        render_time: float,
    ) -> dict:
        return {
            "score": round(candidate.score, 4),
            "transition_type": candidate.transition_type,
            "preview_url": f"/media/previews/{preview_path.name}",
            "preview_path": str(preview_path.resolve()),
            "render_seconds": round(render_time, 4),
            "components": {name: round(value, 4) for name, value in candidate.components.items()},
            "reasons": candidate.reasons,
            "source_segment": self._window_payload(candidate.source_window, candidate.source_segment),
            "target_segment": self._window_payload(candidate.target_window, candidate.target_segment),
        }

    def _window_payload(self, window, segment) -> dict:
        return {
            "index": segment.index,
            "label": f"{segment.label} window",
            "start": round(window.start, 3),
            "end": round(window.end, 3),
            "duration": round(window.end - window.start, 3),
            "bpm": round(window.bpm, 3),
            "bar_count": window.bar_count,
            "phrase_bars": window.bar_count,
            "key": window.key,
            "key_confidence": round(window.key_confidence, 4),
            "loudness": round(window.loudness, 4),
            "brightness": round(window.brightness, 4),
            "onset_density": round(window.onset_density, 4),
            "percussiveness": round(window.percussiveness, 4),
            "vocal_likelihood": round(window.vocal_likelihood, 4),
            "repetition_score": round(segment.repetition_score, 4),
            "intro_likelihood": round(segment.intro_likelihood, 4),
            "outro_likelihood": round(segment.outro_likelihood, 4),
        }

    def _download_tracks_in_parallel(
        self,
        source_url: str,
        target_url: str,
        progress_callback: Callable[[dict], None] | None,
    ) -> tuple[object, object, dict[str, float]]:
        progress_state = defaultdict(
            lambda: {
                "fraction": 0.0,
                "status": "queued",
                "message": "Waiting to start.",
            }
        )
        state_lock = Lock()

        def emit_progress(kind: str, update: dict) -> None:
            if progress_callback is None:
                return
            with state_lock:
                progress_state[kind].update(update)
                source_fraction = float(progress_state["source"].get("fraction") or 0.0)
                target_fraction = float(progress_state["target"].get("fraction") or 0.0)
                combined = (source_fraction + target_fraction) / 2.0
                progress = 0.03 + 0.61 * max(0.0, min(1.0, combined))
                message = (
                    "Downloading tracks in parallel. "
                    f"Outgoing: {progress_state['source']['message']} "
                    f"Incoming: {progress_state['target']['message']}"
                )
                statuses = {progress_state["source"]["status"], progress_state["target"]["status"]}
                stage = "extracting" if "extracting" in statuses else "downloading"
            self._emit(progress_callback, progress, message, stage)

        def timed_download(url: str, prefix: str) -> tuple[object, float]:
            started = perf_counter()
            track = self.downloader.download(
                url,
                prefix,
                progress_callback=lambda update: emit_progress(prefix, update),
            )
            return track, perf_counter() - started

        started = perf_counter()
        with ThreadPoolExecutor(max_workers=2) as executor:
            source_future = executor.submit(timed_download, source_url, "source")
            target_future = executor.submit(timed_download, target_url, "target")
            source_track, source_time = source_future.result()
            target_track, target_time = target_future.result()

        return source_track, target_track, {
            "download_source": round(source_time, 4),
            "download_target": round(target_time, 4),
            "download_wall": round(perf_counter() - started, 4),
        }

    def _emit(
        self,
        progress_callback: Callable[[dict], None] | None,
        progress: float,
        message: str,
        stage: str,
        timings: dict | None = None,
    ) -> None:
        if progress_callback is None:
            return
        payload = {
            "progress": round(max(0.0, min(1.0, progress)), 4),
            "message": message,
            "stage": stage,
        }
        if timings is not None:
            payload["timings"] = timings
        progress_callback(payload)
