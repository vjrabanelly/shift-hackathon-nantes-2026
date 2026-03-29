#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

  echo "Playing: $label"
  afplay "$file"
}

echo "========================================"
echo "  rAIdio — Demo audio sequence (macOS)"
echo "========================================"
echo "  Player : afplay"

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
