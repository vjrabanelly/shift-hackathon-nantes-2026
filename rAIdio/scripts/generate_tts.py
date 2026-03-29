#!/usr/bin/env python3
"""
Generate WAV files with the project's TTS backend.

Examples:
    uv run --project backend python scripts/generate_tts.py \
        --text "Alerte inondation sur le secteur nord." \
        --output /tmp/alerte.wav

    uv run --project backend python scripts/generate_tts.py \
        --input-file scripts/examples/tts_lines.txt \
        --output-dir /tmp/tts

Input file format:
    - One sentence per line -> output names are auto-generated (001.wav, 002.wav, ...)
    - Or "output_path<TAB>text" per line to control each output path explicitly
    - Empty lines and lines starting with "#" are ignored
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate WAV files with the project TTS.")
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--text", help="Text to synthesize.")
    source_group.add_argument(
        "--input-file",
        type=Path,
        help="Batch input file. Each line can be either plain text or 'output_path<TAB>text'.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output WAV path for --text mode.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Output directory for batch mode when lines do not provide explicit paths.",
    )
    parser.add_argument(
        "--prefix",
        default="tts",
        help="Filename prefix used in batch mode when auto-generating file names. Default: tts",
    )
    return parser.parse_args()


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_synthesize():
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    from tts import synthesize

    return synthesize


def write_audio(text: str, output_path: Path) -> None:
    if not text.strip():
        raise ValueError("Text is empty.")

    synthesize = load_synthesize()
    result = synthesize(text.strip())
    ensure_parent_dir(output_path)
    output_path.write_bytes(result["audio_bytes"])
    print(f"[OK] {output_path} ({result['duration_ms']}ms)")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:40] or "audio"


def parse_batch_line(raw_line: str) -> tuple[str | None, str]:
    if "\t" in raw_line:
        output_path, text = raw_line.split("\t", 1)
        return output_path.strip() or None, text.strip()
    return None, raw_line.strip()


def process_batch(input_file: Path, output_dir: Path | None, prefix: str) -> None:
    if not input_file.is_file():
        raise FileNotFoundError(f"Input file not found: {input_file}")

    lines = input_file.read_text(encoding="utf-8").splitlines()
    generated = 0

    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        explicit_output, text = parse_batch_line(line)
        if not text:
            continue

        if explicit_output is not None:
            target = Path(explicit_output)
        else:
            if output_dir is None:
                raise ValueError(
                    "Batch mode requires --output-dir when the input file does not provide output paths."
                )
            filename = f"{index:03d}-{prefix}-{slugify(text)}.wav"
            target = output_dir / filename

        write_audio(text, target)
        generated += 1

    if generated == 0:
        raise ValueError(f"No valid lines found in {input_file}")

    print(f"[DONE] Generated {generated} file(s)")


def main() -> int:
    args = parse_args()

    if args.text is not None:
        if args.output is None:
            raise ValueError("--output is required with --text")
        write_audio(args.text, args.output)
        return 0

    process_batch(args.input_file, args.output_dir, args.prefix)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1)
