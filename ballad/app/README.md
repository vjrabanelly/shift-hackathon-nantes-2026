# App Android

Le module `app` contient le prototype Android actuel de Hike Buddy.

Le flux le plus concret aujourd'hui est l'import d'un GPX, son enrichissement via `hikecore`, puis l'export d'un GPX enrichi et des fichiers audio associés. Le module contient aussi un flux expérimental autour d'un faux moteur TTS Android.

## Ce que fait le module aujourd'hui

- démarre une activité Compose minimaliste
- demande les permissions de localisation et démarre un service de foreground
- permet de sélectionner un fichier GPX et de lancer un enrichissement
- écrit le GPX enrichi dans `Downloads`
- expose un écran debug pour consulter et partager les logs TTS
- embarque un `TextToSpeechService` factice pour intercepter des déclencheurs audio

## Prérequis

- Java 17
- Android SDK configuré
- `sdk.dir` dans `local.properties` ou `ANDROID_HOME` défini

Sans SDK Android configuré, `./gradlew :app:assembleDebug` échoue immédiatement.

## Configuration locale

Le module Android ne lit pas `.env`. Les clés sont injectées depuis le fichier racine `local.properties` dans `BuildConfig`.

Exemple minimal :

```properties
sdk.dir=/chemin/vers/Android/sdk
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
```

Clés acceptées :

- `OPENAI_API_KEY` ou `openai_api_key`
- `MISTRAL_API_KEY` ou `mistral_api_key`

## Commandes utiles

Depuis la racine :

```bash
./gradlew :app:assembleDebug
```

Le build n'a de sens qu'une fois le SDK Android configuré.

## Flux fonctionnels actuels

### 1. Import et enrichissement GPX

Le flux principal passe par `MainScreen` et `MainViewModel` :

1. l'utilisateur choisit un fichier GPX
2. le contenu est lu en mémoire
3. `HikeCore.createGpxRouteEnrichmentService(...)` enrichit le GPX
4. le résultat est sauvegardé dans `Downloads/enriched.gpx`
5. les fichiers audio sont écrits dans le stockage interne de l'application, sous `files/route-audio`

Ce flux dépend de clés OpenAI et d'au moins un provider TTS.

### 2. Service de foreground et proximité

`BalladService` démarre comme service de localisation de foreground. Il ne génère pas lui-même les POI : il surveille la position et, lorsqu'il reçoit une liste de déclencheurs, attend que l'utilisateur soit à proximité d'un point pour jouer un fichier audio local.

### 3. Faux moteur TTS Android

Le module embarque `FakeTtsService`, un `TextToSpeechService` expérimental. Son rôle est de :

- intercepter des textes envoyés au moteur TTS
- y détecter des identifiants d'assets au format `hb_at_<uuid>_<lat>_<lon>`
- transmettre ces déclencheurs à `BalladService`

Le bouton "Changer le moteur TTS" ouvre les réglages TTS Android pour faciliter les essais.

## Contrat de nommage audio

Le prototype Android repose sur un contrat implicite entre `hikecore` et `app` :

- `hikecore` génère des waypoints/identifiants audio nommés `hb_at_<uuid>_<lat>_<lon>`
- les coordonnées encodées correspondent au point de déclenchement projeté sur le tracé, pas forcément à la position réelle du bâtiment ou du POI
- `FakeTtsService` extrait ces identifiants d'un texte TTS
- `BalladService` attend d'être à proximité de ce point avec un rayon dépendant du niveau de détail courant : `10 m` en `SHORT`, `20 m` en `BALANCED`, `35 m` en `DETAILED`

Ce contrat est documenté tel quel ici car il structure le prototype actuel, même s'il n'est pas encore encapsulé par une API dédiée.

## Éléments encore expérimentaux

- `HikeRepository` est actuellement fourni par `FakeHikeRepository` dans le module Android
- `LocationSender` est branché sur `FakeLocationSender`
- autrement dit, le chemin debug/historique autour de `sendLocation()` reste stubbé

Le flux le plus représentatif de l'état du projet est donc bien l'enrichissement GPX, pas le chemin debug hérité.

## Points d'entrée utiles

- `MainActivity` : permissions et démarrage du service de foreground
- `MainScreen` : import GPX et actions utilisateur principales
- `MainViewModel` : orchestration de l'enrichissement
- `BalladService` : surveillance de proximité et lecture audio locale
- `FakeTtsService` : interception expérimentale du moteur TTS
- `DebugScreen` : partage des logs TTS
