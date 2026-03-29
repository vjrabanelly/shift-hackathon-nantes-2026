# Ballad — Project Conventions

This file is the single source of truth for AI agents working on this codebase.

## Project Overview

Ballad is a mobile app that provides location-triggered audio messages describing the user's surroundings while hiking or walking. Content covers nature, sightseeing, and local history — like having a knowledgeable guide narrating points of interest as you move through an area.

## Status

This repository contains working Kotlin, server, Android, and browser-extension prototypes.
The project is still exploratory in product terms, but there is already executable code in `app/`, `hikecore/`, `server/`, and `chrome-extension/`.

## Further Reading

- [voice-language-tone.md](voice-language-tone.md) — modèle de cohérence entre génération LLM et synthèse TTS Mistral (langue, ton, `Voice` comme source de vérité)

## Key Design Priorities

- **Hands-free experience**: The app should work in the background with minimal screen interaction
- **Location-triggered audio**: GPS geofencing detects proximity to points of interest and plays relevant audio
- **Content-driven**: The core value is the audio descriptions (nature, history, sightseeing), not navigation
- **Generative AI throughout**: The project must use generative AI extensively — for content generation (POI descriptions), audio narration (TTS/voice synthesis), and any other areas where AI can enhance the experience
- **Offline-first**: Hikers frequently lose cell signal; maps, audio, and POI data must work offline
- **`hikecore` is a shared module**: It must remain usable by the Android app (`app/`), the server (`server/`), and any future consumers. Do not introduce dependencies or APIs incompatible with any of these environments (e.g. no JVM-desktop-only APIs incompatible with Android, no Android-specific code inside `hikecore`).
