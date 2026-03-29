#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_AUDIO_DEVICE="${DEMO_AUDIO_DEVICE:-plughw:2,0}"
DEMO_SAMPLE_RATE="${DEMO_SAMPLE_RATE:-48000}"
DEMO_CHANNELS="${DEMO_CHANNELS:-1}"

FILES=(
  "$ROOT_DIR/annonce_radio.mp3"
  "$ROOT_DIR/alert_critical.wav"
  "$ROOT_DIR/regles-securite.wav"
  "$ROOT_DIR/synthese-annonce.wav"
)

wait_for_space() {
  local label="$1"
  echo
  echo "Press space to play: $label"
  while true; do
    IFS= read -rsn1 key
    if [[ "$key" == " " ]]; then
      break
    fi
  done
}

play_file() {
  local file="$1"
  local label="$2"

  if [[ ! -f "$file" ]]; then
    echo "Missing file: $file" >&2
    exit 1
  fi

  echo "Playing on $DEMO_AUDIO_DEVICE: $label"
  ffmpeg -nostdin -loglevel error -i "$file" \
    -f s16le \
    -acodec pcm_s16le \
    -ar "$DEMO_SAMPLE_RATE" \
    -ac "$DEMO_CHANNELS" \
    pipe:1 | aplay -q \
    -D "$DEMO_AUDIO_DEVICE" \
    -f S16_LE \
    -r "$DEMO_SAMPLE_RATE" \
    -c "$DEMO_CHANNELS"
}

echo "========================================"
echo "  rAIdio — Demo audio sequence"
echo "========================================"
echo "  Output device : $DEMO_AUDIO_DEVICE"
echo "  Sample rate   : $DEMO_SAMPLE_RATE"
echo "  Channels      : $DEMO_CHANNELS"

wait_for_space "annonce_radio.mp3"
play_file "${FILES[0]}" "annonce_radio.mp3"

echo
echo "Auto-playing: alert_critical.wav"
play_file "${FILES[1]}" "alert_critical.wav"

wait_for_space "regles-securite.wav"
play_file "${FILES[2]}" "regles-securite.wav"

wait_for_space "synthese-annonce.wav"
play_file "${FILES[3]}" "synthese-annonce.wav"

echo
echo "Sequence complete."
