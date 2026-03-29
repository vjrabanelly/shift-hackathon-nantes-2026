#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# rAIdio — Demo : injecte un fichier audio a la place de la webradio
#
# Usage:
#   ./demo/demo_radio.sh demo/alert_inondation.wav
#   ./demo/demo_radio.sh demo/alert_inondation.mp3 --debug
#   ./demo/demo_radio.sh /path/to/any/audio.wav --no-radio-capture  # juste le pipeline PTT
#
# Le fichier audio est lu en boucle a vitesse reelle par ffmpeg,
# puis passe dans le pipeline STT -> keyword -> LLM exactement
# comme un vrai flux radio.
#
# Pour generer un fichier de demo :
#   ./demo/generate_alert_audio.py
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <audio_file> [--debug] [--no-radio-capture]"
    echo ""
    echo "Exemples:"
    echo "  $0 demo/alert_inondation.wav"
    echo "  $0 demo/alert_inondation.wav --debug"
    echo ""
    echo "Generer un fichier de demo :"
    echo "  uv run --project backend python demo/generate_alert_audio.py"
    exit 1
fi

AUDIO_FILE="$1"
shift

# Resoudre en chemin absolu
if [[ ! "$AUDIO_FILE" = /* ]]; then
    AUDIO_FILE="$ROOT_DIR/$AUDIO_FILE"
fi

if [ ! -f "$AUDIO_FILE" ]; then
    echo "Erreur: fichier introuvable: $AUDIO_FILE"
    exit 1
fi

echo "========================================"
echo "  rAIdio — Demo radio (fichier local)"
echo "========================================"
echo "  Fichier : $AUDIO_FILE"
echo "  Mode    : boucle temps reel (ffmpeg -re -stream_loop -1)"
echo ""

export RADIO_STREAM_URL="$AUDIO_FILE"
export RADIO_ENABLED=1
export RADIO_DEBUG="${RADIO_DEBUG:-0}"

cd "$ROOT_DIR/backend"
exec uv run python main.py "$@"
