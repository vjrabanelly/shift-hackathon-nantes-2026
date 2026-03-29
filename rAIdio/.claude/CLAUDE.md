# rAIdio — Radio IA d'urgence

## Contexte

Projet hackathon Shift Nantes 2026. Une radio intelligente pour les situations d'urgence (catastrophes naturelles, coupures réseau/électricité).

## Objectif

Une famille sinistrée isolée dispose d'une radio intelligente qui :
1. Peut répondre à leurs questions de survie via une IA embarquée
2. Leur permet d'écouter les alertes diffusées sur fréquence FM

## Hardware

- Raspberry Pi (embarque le LLM et la logique applicative)
- Radio FM (réception des alertes, utilisation du speaker pour la sortie audio)

## Use cases

- Répondre à des questions de survie : où trouver de l'eau, où s'abriter, comment gérer un blessé...
- Écouter les alertes et informations d'urgence diffusées sur les fréquences FM

## Contraintes

- Pas de réseau internet
- Pas d'électricité (alimentation autonome : batterie, solaire, dynamo...)
- LLM embarqué (doit tourner en local sur le Raspberry Pi)
- Utilisation du speaker de la radio existante pour la sortie audio

## Phase 1 — Pipeline vocal

Pipeline : PTT (Push-to-Talk) → STT (Speech-to-Text) → LLM → TTS (Text-to-Speech) → Speaker

### Stack

- **STT** : Whisper (local)
- **LLM** : Ollama avec Ministral
- **TTS** : à définir (local)

### Découpage en 3 parties (3 devs en parallèle)

1. **Capture audio (PTT → STT)** — Bouton push-to-talk, enregistrement micro, transcription via Whisper
2. **Cerveau IA (STT → LLM → texte)** — Réception du texte transcrit, appel Ollama/Ministral, génération de la réponse
3. **Sortie audio (texte → TTS → Speaker)** — Synthèse vocale de la réponse, lecture sur le speaker de la radio

### Interfaces entre les parties

- Partie 1 → Partie 2 : texte transcrit (string)
- Partie 2 → Partie 3 : texte de la réponse (string)

### MVP — Interface web dockerisée

- **Docker** : un seul `docker compose up` lance tout le stack
- **Frontend** : page web avec :
  - Un visuel de radio avec un bouton PTT (push-to-talk maintenu = enregistrement)
  - Un graphe waterfall en dessous montrant le pipeline en temps réel (PTT → STT → LLM → TTS → Speaker) avec l'état de chaque étape (idle, en cours, terminé, durée)
- **Backend** : API qui orchestre le pipeline et pousse les événements de progression au frontend (WebSocket)
- **Stack technique** : Python (FastAPI + WebSocket), frontend HTML/JS, Docker Compose (frontend + backend + Ollama)

### Corpus de connaissances (fichiers MD)

Le LLM seul ne suffit pas — il faut l'alimenter avec des documents de procédures de secours locaux pour qu'il donne des réponses fiables et contextualisées.

**Sources à intégrer :**
- DICRIM de Nantes (Document d'Information Communal sur les Risques Majeurs)
- Plans communaux de sauvegarde
- Guides de gestes de premiers secours (PSC1, etc.)
- Fiches réflexes par type de risque (inondation, tempête, séisme, industriel...)

**Approche :** Fichiers Markdown (type skills)
- Dossier `data/knowledge/` avec des fiches thématiques (`eau.md`, `abri.md`, `premiers-secours.md`, `inondation.md`...)
- Sélection des fiches pertinentes par keyword matching ou prompt de routage
- Injection des fiches sélectionnées dans le system prompt de Ministral
- Pas de dépendance supplémentaire, léger en RAM (pas d'embedding model)
- Évolution possible vers RAG en phase 2 si le corpus grossit
