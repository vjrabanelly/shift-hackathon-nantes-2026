#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${RAIDIO_RADIO_INPUT:=}"
: "${RAIDIO_JABRA_INPUT:=}"
: "${RAIDIO_JABRA_OUTPUT:=}"
: "${RAIDIO_PTT_DEVICE:=}"
: "${RAIDIO_PTT_BUTTON:=left}"
: "${USE_WEB_RADIO:=1}"
: "${RADIO_SOURCE:=auto}"

export RADIO_FALLBACK_INPUT_DEVICE="$RAIDIO_RADIO_INPUT"
export USE_WEB_RADIO
export RADIO_SOURCE

if [[ -z "$RAIDIO_RADIO_INPUT" || -z "$RAIDIO_JABRA_INPUT" || -z "$RAIDIO_JABRA_OUTPUT" || -z "$RAIDIO_PTT_DEVICE" ]]; then
  cat <<'EOF'
Missing Raspberry runtime configuration.

Set these environment variables before launching:
  RAIDIO_RADIO_INPUT   Audio input for the radio jack source
  RAIDIO_JABRA_INPUT   Audio input for the Jabra microphone
  RAIDIO_JABRA_OUTPUT  Audio output for the Jabra speaker
  RAIDIO_PTT_DEVICE    Mouse event device, for example /dev/input/event3

Optional:
  RAIDIO_PTT_BUTTON    left|right|middle (default: left)
  USE_WEB_RADIO        1|0 compatibility flag for web radio enablement (default: 1)
  RADIO_SOURCE         auto|web|line-in|off (recommended, default: auto)

The radio jack input is exported as RADIO_FALLBACK_INPUT_DEVICE for the backend
radio monitor. It should only be used when the configured webradio is unreachable.

Examples:
  uv run --project backend python backend/pi_mouse_ptt.py --list-audio
  uv run --project backend python backend/pi_mouse_ptt.py --list-mice

  export RAIDIO_RADIO_INPUT="USB PnP Sound Device"
  export RAIDIO_JABRA_INPUT="Jabra"
  export RAIDIO_JABRA_OUTPUT="Jabra"
  export RAIDIO_PTT_DEVICE="/dev/input/event3"
  bash scripts/run_raspberry_mouse_ptt.sh
EOF
  exit 1
fi

uv run --project "$ROOT_DIR/backend" python "$ROOT_DIR/backend/pi_mouse_ptt.py" \
  --radio-input "$RAIDIO_RADIO_INPUT" \
  --jabra-input "$RAIDIO_JABRA_INPUT" \
  --jabra-output "$RAIDIO_JABRA_OUTPUT" \
  --ptt-device "$RAIDIO_PTT_DEVICE" \
  --ptt-button "$RAIDIO_PTT_BUTTON" \
  "$@"
