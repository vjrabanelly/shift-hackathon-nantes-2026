#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

uv run --project "$ROOT_DIR/backend" python "$ROOT_DIR/scripts/generate_tts.py" \
  --input-file "$ROOT_DIR/demo/tts_lines.txt" \
  --output-dir "$ROOT_DIR/demo"
