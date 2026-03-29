# Hike Buddy

Hike Buddy est un compagnon vocal contextuel pour la randonnée.

Le produit ne cherche pas à remplacer une application de cartographie comme AllTrails, Komoot ou Visorando. L'idée est de fonctionner à côté d'elle : pendant que l'app principale garde la carte et le guidage visuel, Hike Buddy suit la sortie, comprend le contexte et déclenche des interventions audio au bon moment.

Ce dépôt contient déjà plusieurs prototypes et briques techniques concrètes autour de cette idée : un module Kotlin réutilisable, un serveur local, une application Android de démonstration et une extension Chrome de support pour les essais autour de Google Maps.

## Positionnement produit

Hike Buddy vise surtout deux usages :

- **mode parcours** : partir d'un GPX, préparer des points d'intérêt, générer les textes et l'audio, puis rejouer le tout au bon moment pendant la sortie
- **mode exploration** : suivre une position GPS sans parcours prédéfini et raconter l'environnement immédiat

Les interventions peuvent être :

- des encouragements liés à l'effort ou au relief
- des informations sur la progression
- de la découverte locale, historique, culturelle ou nature
- une présence audio légère pour rendre la sortie moins solitaire

Le MVP actuel privilégie clairement le **mode parcours** et les flux de préparation/enrichissement GPX.

## État actuel du dépôt

Le dépôt n'est plus seulement un cadrage produit : il contient déjà du code exécutable, mais avec des niveaux de maturité différents selon les modules.

- `hikecore` est la brique la plus structurée : tests, CLI, découverte de POI, enrichissement GPX, génération texte/audio
  - le pipeline s'appuie sur des sources exactes OSM / Wikipedia / Wikidata, et le mode `DETAILED` peut ajouter un résumé `Wikivoyage` exact dérivé de Wikidata ainsi qu'un petit bloc de facts Wikidata
- `server` expose localement plusieurs endpoints Ktor au-dessus de `hikecore`
- `app` est un prototype Android centré sur l'import GPX, l'enrichissement et un flux expérimental autour d'un faux moteur TTS
- `chrome-extension` sert de support expérimental pour des essais sur Google Maps et un serveur local
- `docs` contient le cadrage d'architecture et les notes de structure

## Carte rapide des modules

- [`app/`](app/README.md) : prototype Android du flux mobile actuel
- [`hikecore/`](hikecore/README.md) : noyau Kotlin réutilisable, CLI et pipelines d'enrichissement
- [`server/`](server/README.md) : API locale Ktor pour le développement et les démonstrations
- [`chrome-extension/`](chrome-extension/README.md) : extension Chrome expérimentale pour Google Maps
- [`docs/`](docs/README.md) : index documentaire et cadrage d'architecture

## Démarrage rapide

### Prérequis communs

- Java 17
- le wrapper Gradle du dépôt (`./gradlew`)
- un accès réseau si vous voulez appeler Overpass, OpenAI ou Mistral

### Commandes vérifiées dans ce dépôt

Depuis la racine :

```bash
./gradlew projects
./gradlew :hikecore:test
./gradlew :server:classes
```

Ces commandes ont été relancées et observées avec succès pendant cette passe documentaire.

### Commandes utiles pour poursuivre

```bash
./gradlew :hikecore:run --args='help'
./gradlew :server:run
./gradlew :app:assembleDebug
```

Notes importantes :

- `:app:assembleDebug` nécessite un SDK Android configuré via `ANDROID_HOME` ou `sdk.dir` dans `local.properties`
- le module Android lit ses clés depuis `local.properties`, pas depuis `.env`

## Configuration locale

### `.env`

Le fichier racine `.env` est surtout utile pour :

- le module `server`
- la tâche `:hikecore:ttsGenerate`

Vous pouvez partir de [`.env.example`](.env.example).

### Configuration CLI `hikecore`

Les commandes CLI `hikecore` qui appellent OpenAI/TTS résolvent leurs clés dans cet ordre :

- variables exportées dans le shell courant
- fichier racine `.env` (ou `.env` dans un parent du répertoire courant)
- fichier racine `local.properties`

En pratique :

- `generate` et `route-enrich` attendent des variables exportées (`OPENAI_API_KEY`, `MISTRAL_API_KEY`)
- `route-pois` peut fonctionner sans clé OpenAI, avec un reranking uniquement déterministe si aucun scorer LLM n'est disponible

### `local.properties`

Le module Android s'appuie sur le fichier racine `local.properties` pour :

- la localisation du SDK Android (`sdk.dir=...`)
- les clés injectées dans `BuildConfig`

Les clés acceptées sont :

- `OPENAI_API_KEY` ou `openai_api_key`
- `MISTRAL_API_KEY` ou `mistral_api_key`

## CI/CD — Firebase App Distribution

Chaque push sur `main` déclenche un workflow GitHub Actions qui :

1. compile un APK release signé
2. le distribue via Firebase App Distribution au groupe `testers`

### Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `FIREBASE_APP_ID` | ID de l'app Android Firebase (format : `1:xxx:android:xxx`) |
| `FIREBASE_TOKEN` | Token obtenu via `firebase login:ci` |
| `KEYSTORE_BASE64` | Keystore encodé en base64 : `base64 hikbuddy.keystore` |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore et de la clé |
| `KEY_ALIAS` | Alias de la clé (par défaut : `hikbuddy`) |

### Générer un keystore

```bash
keytool -genkey -v -keystore hikbuddy.keystore \
  -alias hikbuddy -keyalg RSA -keysize 2048 -validity 10000
```

Puis encoder en base64 pour le secret GitHub :

```bash
base64 hikbuddy.keystore
```

## Documentation disponible

- [`docs/architecture.md`](docs/architecture.md) : découpage d'architecture et logique préparation/runtime
- [`docs/voice-language-tone.md`](docs/voice-language-tone.md) : modèle actuel `VoiceConfig` / langue / voix / ton
- [`hikecore/README.md`](hikecore/README.md) : commandes CLI, tests et tâches audio du noyau Kotlin
- [`app/README.md`](app/README.md) : flux Android actuel, build et faux moteur TTS
- [`server/README.md`](server/README.md) : endpoints locaux et configuration serveur
- [`chrome-extension/README.md`](chrome-extension/README.md) : extension Google Maps, widget injecté et état expérimental
- [`CONTRIBUTING.md`](CONTRIBUTING.md) : onboarding léger et conventions de contribution

## Composants expérimentaux à connaître

Quelques briques sont volontairement documentées **tel quel** plutôt que nettoyées dans cette passe :

- dans `app`, une partie des dépendances injectées reste branchée sur des implémentations factices pour le flux debug/historique
- le flux Android autour du faux moteur TTS repose sur un contrat de nommage des assets audio (`hb_at_<uuid>_<lat>_<lon>`), où `lat/lon` pointent le point de déclenchement projeté sur le tracé
- l'extension Chrome contient des fichiers `popup.*`, mais le `manifest.json` n'expose pas actuellement de `default_popup` ; le flux réellement branché est le widget injecté dans Google Maps

## Notes annexes

Le fichier [`DESIGN.md`](DESIGN.md) reste une note d'idéation produit. Le kit de préparation du pitch hackathon est désormais centralisé dans [`demo/DEMO.md`](demo/DEMO.md). Pour comprendre l'état actuel du code, les README de modules et `docs/architecture.md` restent les meilleures sources de vérité.
