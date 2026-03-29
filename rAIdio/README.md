# rAIdio — Radio IA d'urgence

Poste radio intelligent embarquant une IA pour les situations d'urgence (catastrophes naturelles, coupures reseau/electricite).

## Installation rapide

```bash
chmod +x install.sh && ./install.sh
```

Sur macOS :

```bash
chmod +x install-macos.sh && ./install-macos.sh
```

Le script installe tout automatiquement :
1. Dependances systeme (libportaudio2, espeak-ng)
2. Dependances Python (uv sync)
3. Demarrage Ollama
4. Modeles IA (Ollama ministral-3:3b, Whisper configurable, Kokoro TTS)
5. Ingestion RAG (ChromaDB)
6. Verification des composants

### Prerequisites

- Python 3.13+
- [uv](https://docs.astral.sh/uv/)
- [Ollama](https://ollama.ai/)

### Installation manuelle (alternative)

```bash
cd backend
uv sync
uv run python download_models.py
uv run python ingest.py --reset
```

## Usage

### Serveur web (interface radio)

```bash
cd backend && uv run python main.py
```

Ouvrir http://localhost:8000

### CLI (micro local, sans navigateur)

```bash
cd backend
uv run python cli.py              # micro par defaut
uv run python cli.py --list       # lister les devices audio
uv run python cli.py --device 2   # choisir un device
```

Configuration STT via variables d'environnement :

- `STT_MODEL=tiny|base|small|medium|large` : modele whisper.cpp a charger (`base` par defaut)
- `WHISPER_MODEL=...` : alias de compatibilite si `STT_MODEL` n'est pas defini
- `WHISPER_THREADS=4` : nombre de threads CPU

Exemples :

```bash
cd backend
STT_MODEL=tiny uv run python cli.py
STT_MODEL=base uv run python cli.py
```

### Script TTS (generation de fichiers audio)

```bash
uv run --project backend python scripts/generate_tts.py \
  --text "Alerte inondation sur le secteur nord." \
  --output /tmp/alerte.wav
```

```bash
uv run --project backend python scripts/generate_tts.py \
  --input-file scripts/examples/tts_lines.txt \
  --output-dir /tmp/tts
```

Ou via `make` :

```bash
make tts TEXT="Alerte inondation sur le secteur nord." OUTPUT=/tmp/alerte.wav
make tts-batch INPUT_FILE=scripts/examples/tts_lines.txt OUTPUT_DIR=/tmp/tts
```

### Lot de demo TTS

Le dossier `demo/` contient un exemple pret a l'emploi pour generer deux fichiers audio de demonstration a partir du script TTS du projet.

```bash
bash demo/generate_demo_tts.sh
```

Le script lit [demo/tts_lines.txt](/Users/charles/Projects/Hackathon/rAIdio/demo/tts_lines.txt) et genere :

- `demo/recap-alerte-meteo.wav`
- `demo/conseil-rester-interieur.wav`

Les fichiers `.wav` du dossier `demo/` sont ignores par git pour eviter de versionner les sorties binaires generees.

### Runtime Raspberry Pi avec PTT souris USB

Le script [scripts/run_raspberry_mouse_ptt.sh](/Users/charles/Projects/Hackathon/rAIdio/scripts/run_raspberry_mouse_ptt.sh) lance le runtime local avec :

- micro Jabra en entree
- sortie audio Jabra
- PTT en maintien de clic souris USB
- entree radio jack reservee comme fallback du monitoring radio

Configuration minimale :

```bash
export RAIDIO_RADIO_INPUT="USB PnP Sound Device"
export RAIDIO_JABRA_INPUT="Jabra"
export RAIDIO_JABRA_OUTPUT="Jabra"
export RAIDIO_PTT_DEVICE="/dev/input/event3"
bash scripts/run_raspberry_mouse_ptt.sh
```

Pour debug :

```bash
uv run --project backend python backend/pi_mouse_ptt.py --list-audio
uv run --project backend python backend/pi_mouse_ptt.py --list-mice
```

Le device `RAIDIO_RADIO_INPUT` n'est pas la source nominale du monitoring radio :

- source normale : webradio via `RADIO_STREAM_URL`
- source de secours : line-in locale via `RADIO_FALLBACK_INPUT_DEVICE`

Le fallback audio local n'est active que si la webradio est inaccessible.

Controle de la source radio au lancement :

- `RADIO_SOURCE=auto` : mode recommande, webradio d'abord puis fallback jack si indisponible
- `RADIO_SOURCE=web` : force la webradio uniquement
- `RADIO_SOURCE=line-in` : force l'entree jack uniquement
- `RADIO_SOURCE=off` : desactive l'ecoute radio

Compatibilite :

- `USE_WEB_RADIO=1` : equivalent pratique a un mode avec webradio active
- `USE_WEB_RADIO=0` : desactive la webradio et bascule sur le jack si `RADIO_FALLBACK_INPUT_DEVICE` existe, sinon coupe l'ecoute radio

Exemples :

```bash
USE_WEB_RADIO=0 RADIO_SOURCE=auto bash scripts/run_raspberry_mouse_ptt.sh
RADIO_SOURCE=line-in bash scripts/run_raspberry_mouse_ptt.sh
RADIO_SOURCE=off bash scripts/run_raspberry_mouse_ptt.sh
```

## Pipeline

```
PTT -> STT (whisper.cpp) -> RAG (ChromaDB) -> LLM (Ollama/Ministral) -> TTS (Kokoro) -> Speaker
```

## Stack

- **STT** : whisper.cpp via pywhispercpp
- **RAG** : ChromaDB (embedding local)
- **LLM** : Ollama + Ministral-3:3b (RPi5) / Mistral 7B (dev)
- **TTS** : Kokoro ONNX (voix francaise ff_siwis)
- **Frontend** : HTML/JS SPA + WebSocket
- **Backend** : FastAPI + WebSocket
