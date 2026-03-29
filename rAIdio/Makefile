.PHONY: help tts tts-batch

TEXT ?= Message de test pour la radio d'urgence.
OUTPUT ?= /tmp/tts.wav
INPUT_FILE ?= scripts/examples/tts_lines.txt
OUTPUT_DIR ?= /tmp/tts
PREFIX ?= tts

help:
	@printf '%s\n' \
	'Targets:' \
	'  make tts TEXT="Alerte evacuation immediate." OUTPUT=/tmp/alerte.wav' \
	'  make tts-batch INPUT_FILE=scripts/examples/tts_lines.txt OUTPUT_DIR=/tmp/tts' \
	'' \
	'Variables:' \
	'  TEXT       Phrase a synthetiser' \
	'  OUTPUT     Fichier WAV de sortie' \
	'  INPUT_FILE Fichier batch en entree' \
	'  OUTPUT_DIR Dossier de sortie pour le batch' \
	'  PREFIX     Prefixe des noms auto-generes en batch'

tts:
	uv run --project backend python scripts/generate_tts.py --text "$(TEXT)" --output "$(OUTPUT)"

tts-batch:
	uv run --project backend python scripts/generate_tts.py --input-file "$(INPUT_FILE)" --output-dir "$(OUTPUT_DIR)" --prefix "$(PREFIX)"
