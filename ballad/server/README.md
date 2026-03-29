# Server

Le module `server` expose une API locale Ktor au-dessus de `hikecore`.

Il sert surtout au développement, aux démonstrations et aux expérimentations rapides autour des endpoints POI / intervention / audio, sans devoir passer par l'application Android.

## Prérequis

- Java 17
- `./gradlew`
- réseau disponible pour Overpass et, selon les endpoints, OpenAI / Mistral

## Configuration

Le serveur charge un fichier `.env` depuis :

- `server/.env` si présent
- sinon la racine du dépôt

Vous pouvez partir de [`.env.example`](../.env.example).

Variables utiles :

- `PORT` : port HTTP local, par défaut `8081`
- `OPENAI_API_KEY`
- `MISTRAL_API_KEY`
- `OPENAI_MODEL`
- `OVERPASS_ENDPOINTS`

## Commandes utiles

Commande vérifiée :

```bash
./gradlew :server:classes
```

Commande de lancement locale :

```bash
./gradlew :server:run
```

## Endpoints exposés

### `GET /pois`

Retourne une liste de POI triés par distance autour d'un point.

Paramètres :

- `lat`
- `lon`
- `radius` : défaut `50`
- `limit` : défaut `10`

Notes :

- utilise Overpass via `HikeRepository`
- ne dépend pas des clés OpenAI/TTS

### `GET /guide`

Retourne un guide audio complet autour d'un point :

- POI retenus
- description texte
- audio encodé en base64

Paramètres :

- `lat`
- `lon`
- `radius`
- `locale`

Notes :

- s'appuie sur `HikeRepository`
- sans clés AI/TTS, le dépôt peut tomber sur le mode mixte Overpass + mocks

### `GET /intervention`

Construit une requête d'intervention à partir d'un point, d'un prompt et de préférences fichier, puis tente de générer texte et audio.

Paramètres :

- `lat`
- `lon`
- `radius`
- `lang`

Notes :

- lit `hikecore/examples/prompt.txt`
- lit `hikecore/examples/preferences.json`
- `lang` est converti en `VoiceConfig.Auto(...)` côté serveur ; l'endpoint ne permet pas encore de choisir une voix explicite
- le niveau de détail et le preset de sélection de POI viennent donc du fichier `preferences.json`, pas des query params
- nécessite en pratique une clé OpenAI valide
- l'audio dépend de la disponibilité d'un provider TTS

### `POST /poi-audio`

Prend un POI manuel (`name`, `lat`, `lon`), demande un texte au modèle puis essaie de générer un audio associé.

Paramètres de query :

- `lang`
- `prompt`

Corps JSON :

```json
{
  "name": "Tour Eiffel",
  "lat": 48.8584,
  "lon": 2.2945
}
```

Notes :

- `lang` est aussi converti en `VoiceConfig.Auto(...)`
- le texte dépend d'OpenAI
- l'audio est optionnel si aucun provider n'est configuré
- les résultats sont archivés localement dans `server/output`

## Sorties locales

Le serveur écrit dans `server/output/` :

- des fichiers audio `.mp3`
- un journal `poi-audio.jsonl` avec les générations manuelles de `/poi-audio`

## Lien avec `hikecore`

Le module `server` ne réimplémente pas la logique métier. Il s'appuie sur :

- `HikeCore.create(HikeConfig())` pour les endpoints historiques / guide
- `NearbyInterventionService.createDefault(...)` pour les endpoints `intervention` et `poi-audio`

Autrement dit, le serveur est avant tout une couche de transport et de démonstration autour des pipelines Kotlin du dépôt.
