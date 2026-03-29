#!/usr/bin/env bash
#
# rAIdio — Script d'installation complet pour macOS
#
# Usage:
#   chmod +x install-macos.sh && ./install-macos.sh
#
# Etapes:
#   1. Verification pre-requis (brew, uv, ollama, python3)
#   2. Dependances systeme (portaudio, espeak)
#   3. Dependances Python (uv sync)
#   4. Demarrage Ollama
#   5. Telechargement modeles (Ollama ministral-3:3b, Whisper, Kokoro TTS)
#   6. Ingestion RAG (ChromaDB)
#   7. Verification finale
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}[$1/$TOTAL] $2${NC}"; }

TOTAL=7

echo ""
echo "========================================"
echo "  rAIdio — Installation macOS"
echo "========================================"

if [ "$(uname -s)" != "Darwin" ]; then
    fail "Ce script est reserve a macOS. Utilise ./install.sh sur Linux."
fi

# ---- 1. Verifier les pre-requis systeme ----
step 1 "Verification des pre-requis systeme"

if command -v brew &>/dev/null; then
    ok "Homebrew installe"
else
    fail "Homebrew non installe. Voir https://brew.sh/"
fi

if command -v uv &>/dev/null; then
    ok "uv $(uv --version 2>/dev/null | head -1)"
else
    fail "uv non installe. Voir https://docs.astral.sh/uv/getting-started/installation/"
fi

if command -v ollama &>/dev/null; then
    ok "ollama installe"
else
    fail "ollama non installe. Voir https://ollama.ai/"
fi

if command -v python3 &>/dev/null; then
    ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
else
    fail "python3 non installe"
fi

# ---- 2. Dependances systeme ----
step 2 "Dependances systeme (brew)"

PKGS_TO_INSTALL=()

if ! brew list --versions portaudio &>/dev/null 2>&1; then
    PKGS_TO_INSTALL+=(portaudio)
fi

if ! brew list --versions espeak &>/dev/null 2>&1; then
    PKGS_TO_INSTALL+=(espeak)
fi

if [ ${#PKGS_TO_INSTALL[@]} -gt 0 ]; then
    echo "  Installation de: ${PKGS_TO_INSTALL[*]}"
    brew install "${PKGS_TO_INSTALL[@]}"
    ok "Paquets systeme installes"
else
    ok "Toutes les dependances systeme sont presentes"
fi

# ---- 3. Dependances Python ----
step 3 "Dependances Python (uv sync)"

cd "$BACKEND_DIR"
uv sync
ok "Dependances Python installees"

# ---- 4. Demarrer Ollama ----
step 4 "Demarrage Ollama"

if curl -s http://localhost:11434/api/version &>/dev/null; then
    ok "Ollama est en cours d'execution"
else
    warn "Ollama ne repond pas sur localhost:11434"
    echo "  Tentative de demarrage en arriere-plan..."
    ollama serve &>/dev/null &
    sleep 3
    if curl -s http://localhost:11434/api/version &>/dev/null; then
        ok "Ollama demarre"
    else
        fail "Impossible de demarrer Ollama. Lance 'ollama serve' manuellement."
    fi
fi

# ---- 5. Telecharger tous les modeles (Ollama + Whisper + Kokoro) ----
step 5 "Telechargement des modeles (ministral-3:3b, Whisper, Kokoro TTS)"

cd "$BACKEND_DIR"
uv run python download_models.py
ok "Tous les modeles sont prets"

# ---- 6. Ingestion RAG (ChromaDB) ----
step 6 "Ingestion des donnees RAG"

cd "$BACKEND_DIR"
if [ -d "chromadb_data" ] && [ -f "chromadb_data/chroma.sqlite3" ]; then
    ok "ChromaDB deja initialisee"
    echo "  (pour reinitialiser: uv run python ingest.py --reset)"
else
    echo "  Ingestion des fichiers CSV dans ChromaDB..."
    uv run python ingest.py --reset
    ok "Donnees RAG ingerees"
fi

# ---- 7. Verification finale ----
step 7 "Verification finale"

echo ""
echo "  Composants:"

cd "$BACKEND_DIR"
if uv run python -c "from stt import transcribe" 2>/dev/null; then
    ok "STT (whisper.cpp)"
else
    warn "STT: erreur d'import"
fi

if uv run python -c "from llm import ask" 2>/dev/null; then
    ok "LLM (Ollama + RAG)"
else
    warn "LLM: erreur d'import"
fi

if uv run python -c "from tts import synthesize" 2>/dev/null; then
    ok "TTS (Kokoro ONNX)"
else
    warn "TTS: erreur d'import"
fi

if uv run python -c "from rag import retrieve_context" 2>/dev/null; then
    ok "RAG (ChromaDB)"
else
    warn "RAG: erreur d'import"
fi

echo ""
echo "========================================"
echo -e "  ${GREEN}Installation terminee !${NC}"
echo "========================================"
echo ""
echo "  Lancer le serveur web:"
echo "    cd backend && uv run python main.py"
echo ""
echo "  Lancer le CLI micro:"
echo "    cd backend && uv run python cli.py"
echo ""
echo "  Ouvrir http://localhost:8000"
echo ""
