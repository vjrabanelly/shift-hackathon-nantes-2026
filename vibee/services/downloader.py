from __future__ import annotations

import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse
from typing import Callable

import soundfile as sf
from yt_dlp import YoutubeDL

from .domain import DownloadedTrack


class AudioDownloader:
    def __init__(self, download_dir: Path) -> None:
        self.download_dir = download_dir

    def download(
        self,
        url: str,
        prefix: str,
        progress_callback: Callable[[dict], None] | None = None,
    ) -> DownloadedTrack:
        local_path = self._resolve_local_path(url)
        if local_path is not None:
            return self._load_local_track(local_path, prefix, progress_callback)

        output_template = str(self.download_dir / f"{prefix}_%(id)s.%(ext)s")

        def progress_hook(update: dict) -> None:
            if progress_callback is None:
                return

            status = update.get("status")
            if status == "downloading":
                downloaded = float(update.get("downloaded_bytes") or 0.0)
                total = float(
                    update.get("total_bytes")
                    or update.get("total_bytes_estimate")
                    or 0.0
                )
                speed = float(update.get("speed") or 0.0)
                eta = update.get("eta")
                fraction = downloaded / total if total > 0 else 0.0
                message = (
                    f"Downloading audio: {self._format_bytes(downloaded)}"
                    + (f" / {self._format_bytes(total)}" if total > 0 else "")
                    + (f" at {self._format_bytes(speed)}/s" if speed > 0 else "")
                    + (f" - ETA {int(eta)}s" if eta is not None else "")
                )
                progress_callback(
                    {
                        "fraction": fraction,
                        "message": message,
                        "status": "downloading",
                    }
                )
            elif status == "finished":
                progress_callback(
                    {
                        "fraction": 1.0,
                        "message": "Download finished. Extracting WAV audio.",
                        "status": "extracting",
                    }
                )

        options = {
            "format": "bestaudio/best",
            "noplaylist": True,
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
            "progress_hooks": [progress_hook],
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                }
            ],
        }

        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            final_path = Path(ydl.prepare_filename(info)).with_suffix(".wav")

        return DownloadedTrack(
            title=info.get("title") or "Unknown title",
            uploader=info.get("uploader") or "Unknown uploader",
            duration=float(info.get("duration") or 0.0),
            source_url=url,
            webpage_url=info.get("webpage_url") or url,
            audio_path=final_path,
        )

    def _resolve_local_path(self, value: str) -> Path | None:
        candidate = value.strip()
        if not candidate:
            return None

        parsed = urlparse(candidate)
        if parsed.scheme == "file":
            raw_path = unquote(parsed.path or "")
            if parsed.netloc:
                raw_path = f"{parsed.netloc}{raw_path}"
            path = Path(raw_path.lstrip("/")) if raw_path.startswith("/") and ":" in raw_path else Path(raw_path)
            if path.exists():
                return path

        path = Path(candidate)
        if path.exists():
            return path

        return None

    def _load_local_track(
        self,
        source_path: Path,
        prefix: str,
        progress_callback: Callable[[dict], None] | None = None,
    ) -> DownloadedTrack:
        if progress_callback is not None:
            progress_callback(
                {
                    "fraction": 0.05,
                    "message": f"Preparing local audio from {source_path.name}.",
                    "status": "extracting",
                }
            )

        prepared_path = self._prepare_local_audio(source_path, prefix)
        info = sf.info(prepared_path)
        duration = float(info.frames / info.samplerate) if info.frames and info.samplerate else 0.0

        if progress_callback is not None:
            progress_callback(
                {
                    "fraction": 1.0,
                    "message": "Local audio is ready for transition analysis.",
                    "status": "extracting",
                }
            )

        return DownloadedTrack(
            title=source_path.stem,
            uploader="Local file",
            duration=duration,
            source_url=str(source_path),
            webpage_url=str(source_path),
            audio_path=prepared_path,
        )

    def _prepare_local_audio(self, source_path: Path, prefix: str) -> Path:
        if source_path.suffix.lower() == ".wav":
            return source_path

        output_path = self.download_dir / f"{prefix}_{source_path.stem}.wav"
        if output_path.exists() and output_path.stat().st_mtime >= source_path.stat().st_mtime:
            return output_path

        output_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source_path),
                str(output_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return output_path

    def _format_bytes(self, value: float) -> str:
        units = ["B", "KB", "MB", "GB"]
        size = float(value)
        for unit in units:
            if size < 1024.0 or unit == units[-1]:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} GB"
