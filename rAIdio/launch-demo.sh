#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export RAIDIO_RADIO_INPUT="${RAIDIO_RADIO_INPUT:-USB Audio Device}"
export RAIDIO_JABRA_INPUT="${RAIDIO_JABRA_INPUT:-Jabra SPEAK 410 USB}"
export RAIDIO_JABRA_OUTPUT="${RAIDIO_JABRA_OUTPUT:-Jabra SPEAK 410 USB}"
export RAIDIO_PTT_DEVICE="${RAIDIO_PTT_DEVICE:-/dev/input/event8}"
export RADIO_SOURCE="${RADIO_SOURCE:-auto}"
export STT_MODEL="${STT_MODEL:-base}"
export WHISPER_THREADS="${WHISPER_THREADS:-4}"

bash "$ROOT_DIR/scripts/run_raspberry_mouse_ptt.sh" "$@"
