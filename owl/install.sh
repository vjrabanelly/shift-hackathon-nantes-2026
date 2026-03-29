#!/bin/bash
set -e

echo "=== OWL - Installation ==="

# 1. Clone Moodle
if [ -d "moodle" ]; then
  echo "[skip] Le dossier 'moodle' existe déjà, clone ignoré."
else
  echo "[1/3] Clonage de Moodle (branche MOODLE_501_STABLE)..."
  git clone -b MOODLE_501_STABLE https://github.com/moodle/moodle.git
fi

# 2. Copier config.php
if [ ! -f "config.php" ]; then
  echo "ERREUR : config.php introuvable à la racine du projet."
  exit 1
fi
echo "[2/3] Copie de config.php dans moodle/..."
cp config.php moodle/config.php

# 3. Copier .env
if [ ! -f ".env.example" ]; then
  echo "ERREUR : .env.example introuvable."
  exit 1
fi
if [ -f ".env" ]; then
  echo "[skip] .env existe déjà, copie ignorée."
else
  echo "[3/3] Copie de .env.example vers .env..."
  cp .env.example .env
  echo "  -> Pensez à renseigner les valeurs dans .env"
fi

echo ""
echo "=== Installation terminée ==="
echo ""
echo "Étapes manuelles restantes :"
echo "  1. Remplir les valeurs dans .env"
echo "  2. Lancer les services (docker compose up -d, etc.)"
echo "  3. Configurer le compte admin Moodle sur http://localhost:8089"
echo "  4. (optionnel) Installer le pack de langue FR :"
echo "     http://localhost:8089/admin/tool/langimport/index.php"
