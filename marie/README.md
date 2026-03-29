# Marie — Détecteur d'arnaques

Marie analyse vos messages suspects (SMS, email, captures d'écran) en temps réel et détecte les tentatives d'arnaque via un pipeline IA multi-étapes.

## Architecture

```
marie/
├── apps/
│   ├── api/        # Backend NestJS — pipeline d'analyse, streaming SSE
│   ├── web/        # Frontend React/Vite — PWA mobile-first
│   └── android/    # App Android Capacitor — interception SMS native
└── packages/
    └── shared/     # Types TypeScript partagés (monorepo)
```

**Flux principal :**
1. Texte ou image soumis via `POST /api/analyses/text|image`
2. Le backend orchestre un pipeline (ingestion → analyse LLM → scoring → explication)
3. Chaque étape est diffusée en temps réel via **SSE** (`GET /api/analyses/:id/stream`)
4. Sur Android, les SMS entrants sont interceptés et proposés automatiquement à l'analyse

---

## Prérequis

- **Node.js** 20+
- **Java 21** (pour Gradle / Android)
- **Android SDK** (pour le build APK)
- **ADB** (pour l'installation sur appareil)

---

## Variables d'environnement

Copiez `.env.example` en `.env` à la racine et complétez :

```env
# API
PORT=3001
FRONTEND_URL=http://localhost:5173
API_KEY=                        # Laisser vide en dev (accès public)

# Fournisseurs IA — priorité : OpenAI > Claude > Mock
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Enrichissement (optionnels)
VIRUSTOTAL_API_KEY=             # Réputation des URLs
GOOGLE_VISION_API_KEY=          # Analyse d'image avancée

# Web
VITE_API_URL=http://localhost:3001
VITE_API_KEY=                   # Même valeur que API_KEY
```

> Si aucune clé LLM n'est fournie, le fournisseur **Mock** est utilisé (réponses simulées).

---

## Démarrage rapide

### Développement local

```bash
npm install      # installe toutes les dépendances (workspaces)
npm run dev      # lance l'API (port 3001) + le Web (port 5173) en parallèle
```

- Frontend : [http://localhost:5173](http://localhost:5173)
- API : [http://localhost:3001](http://localhost:3001)

### Docker

```bash
docker compose up --build
```

| Service | Port | Description |
|---|---|---|
| `api` | 3001 | Backend NestJS |
| `web` | 80 | Frontend nginx |
| `db` | 5432 | PostgreSQL 16 (prévu pour persistance future) |

---

## Apps

### API (`apps/api`)

Backend NestJS. Pipeline d'analyse en 4 étapes :

| Étape | Description |
|---|---|
| **Ingestion** | Réception et normalisation du contenu |
| **Analysis** | 3 appels LLM (métadonnées, fraudes directes, manipulation psychologique) + enrichissement (VirusTotal, OCR) |
| **Scoring** | Calcul du score de risque (0–100) et verdict |
| **Explanation** | Génération du résumé et des actions recommandées |

Chaque étape émet des événements SSE en temps réel (`operation.started`, `operation.completed`, `signals.detected`, `score.updated`, `analysis.completed`…).

```bash
cd apps/api
npm run build        # compile TypeScript → dist/
npm run start:prod   # démarre en production
npm run test         # tests Jest
```

**Endpoints :**

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/analyses/text` | Soumettre un texte |
| `POST` | `/api/analyses/image` | Soumettre une image (multipart) |
| `GET` | `/api/analyses/:id/stream` | Stream SSE temps réel |
| `GET` | `/api/analyses/:id` | Résultat final |

**Fournisseurs IA :**

| Priorité | Fournisseur | Condition |
|---|---|---|
| 1 | OpenAI (`gpt-4o-mini`) | `OPENAI_API_KEY` définie |
| 2 | Claude (`claude-3-5-haiku`) | `ANTHROPIC_API_KEY` définie |
| 3 | Mock | Aucune clé |

---

### Web (`apps/web`)

PWA React, Tailwind CSS v4, animations Framer Motion. Interface mobile avec le personnage Marie (Vert = sûr, Jaune = suspect, Rouge = fraude).

```bash
cd apps/web
npm run build        # build production → dist/
npm run preview      # prévisualiser le build
```

**Variables Vite :**

| Variable | Défaut | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | URL de base de l'API |
| `VITE_API_KEY` | — | Clé API (Bearer ou `?key=`) |
| `VITE_CAPACITOR` | — | `true` pour les builds Android (désactive le SW PWA) |

---

### Android (`apps/android`)

Wrapper Capacitor. Inclut un plugin natif **SmsShield** qui intercepte les SMS entrants, affiche une notification, et envoie le SMS à l'app React via un événement Capacitor (`smsPending`). L'app propose alors une confirmation avant de lancer l'analyse.

**Permissions Android :**

| Permission | Usage |
|---|---|
| `INTERNET` | Appels API |
| `RECEIVE_SMS` | Interception des SMS entrants |
| `POST_NOTIFICATIONS` | Notifications SMS (Android 13+) |

#### Rebuild et déployer

**Synchroniser le web dans Capacitor :**
```bash
cd apps/android
npm run sync
```

**Compiler l'APK debug :**
```bash
npm run build:apk
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

**Installer sur l'appareil connecté :**
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Tout en une commande (rebuild + install) :**
```bash
npm run build:apk && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Ouvrir Android Studio :**
```bash
npx cap open android
```

> L'URL de l'API Android est dans `apps/android/package.json` (`VITE_API_URL`). Modifiez-la si vous changez d'adresse ou de tunnel.

---

## Package partagé (`packages/shared`)

Types TypeScript consommés par l'API et le web. Toute modification est immédiatement disponible sans build séparé (résolution directe via workspace).

**Exports principaux :**
- `Verdict`, `AnalysisStatus`, `InputType` — Enums
- `Signal`, `AuditCheck`, `AuditSection`, `AnalysisResult` — Modèles de résultat
- `SseEventType`, `OperationType` — Types d'événements SSE
- Tous les types d'événements typés (`OperationStartedEvent`, `AnalysisCompletedEvent`…)

---

## Événements SSE

Séquence émise pour une analyse de texte :

```
analysis.created
operation.started   (Ingestion)
operation.completed (Ingestion)
operation.started   (Analysis)
  operation.started   (Extraction des métadonnées)        ← sous-opération
  operation.completed (Extraction des métadonnées)
  operation.started   (Détection des fraudes directes)
  operation.completed (Détection des fraudes directes)
  operation.started   (Analyse des manipulations)
  operation.completed (Analyse des manipulations)
  operation.started   (Vérification des liens — VirusTotal)
  operation.completed (Vérification des liens)
  operation.started   (Vérification de l'expéditeur)
  operation.completed (Vérification de l'expéditeur)
operation.completed (Analysis)
signals.detected
score.updated
operation.started   (Explanation)
operation.completed (Explanation)
explanation.generated
analysis.completed  ← contient l'AnalysisResult complet
```

Le client peut rejoindre le stream en cours de route — un **ReplaySubject** rejoue l'historique complet des événements (TTL 60 secondes après complétion).
