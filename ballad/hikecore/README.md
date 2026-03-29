# HikeCore

`hikecore` regroupe les briques Kotlin réutilisables de Hike Buddy :

- découverte de POI autour d'un point ou d'un parcours
- préparation de prompts d'intervention
- génération de texte via OpenAI
- synthèse audio via Mistral
- enrichissement d'un GPX avec waypoints audio

Sur les POI enrichis, le module reste strict sur l'identité du lieu :

- `Wikipedia` n'est utilisée que si le tag OSM `wikipedia` est présent
- `Wikidata` n'est utilisée que si le tag OSM `wikidata` est présent
- le mode `DETAILED` peut ajouter un résumé `Wikivoyage`, mais uniquement via un sitelink exact dérivé de Wikidata
- aucun provider ne fait de recherche fuzzy par nom

Le module expose aussi une CLI pratique pour tester ces pipelines sans passer par l'application Android.

## Prérequis

- Java 17
- `./gradlew`
- réseau disponible pour Overpass et, selon les cas, OpenAI / Mistral

## Commandes vérifiées

Depuis la racine du dépôt :

```bash
./gradlew :hikecore:test
./gradlew :hikecore:run --args='help'
```

## Configuration locale

### Résolution des clés CLI

Les commandes CLI `generate`, `route-pois`, `route-enrich` et `tts` cherchent leurs clés dans cet ordre :

```bash
export OPENAI_API_KEY="..."
export MISTRAL_API_KEY="..."
```

Puis en fallback local :

- `.env` dans le répertoire courant ou un parent
- `local.properties` dans le répertoire courant ou un parent

Important :

- `generate` exige `OPENAI_API_KEY`
- `generate --with-audio` exige en plus `MISTRAL_API_KEY`
- `route-enrich` exige `OPENAI_API_KEY` et `MISTRAL_API_KEY`
- `route-pois` peut fonctionner sans clé OpenAI ; dans ce cas le reranking reste déterministe

### `.env`

Un fichier `.env` à la racine du dépôt suffit désormais aussi pour les commandes CLI principales si les variables ne sont pas déjà exportées dans le shell.

### Préférences métier dans `preferences.json`

Le fichier [`examples/preferences.json`](examples/preferences.json) reste la source de vérité la plus simple pour piloter le comportement éditorial des commandes `generate` et `route-enrich`.

Champs principaux :

- `poi_selection_mode` : `balanced`, `nature`, `history`, `architecture`, `panorama`
- `intervention_detail_level` : `short`, `balanced`, `detailed`
- `user_age_range` : `adult`, `15_18`, `12_14`, `8_11`, `under_8`
- `max_length_sentences` : champ legacy toujours supporté, mais réaligné automatiquement sur le niveau de détail (`2`, `3`, `5`)

Politique de contexte actuelle :

- `SHORT` : 1 bloc maximum, très compact
- `BALANCED` : 2 blocs maximum
- `DETAILED` : 3 blocs maximum, avec possibilité d'ajouter `Wikivoyage` exact et des facts Wikidata

En pratique :

- `SHORT` privilégie `Wikipedia`, puis `Wikidata`
- `BALANCED` reste proche du comportement historique, avec `Wikipedia` puis `Wikidata`
- `DETAILED` priorise `Wikipedia`, puis `Wikivoyage`, puis un bloc de facts Wikidata, avant la description Wikidata si elle reste utile

## Vue d'ensemble des commandes

La CLI se lance via :

```bash
./gradlew :hikecore:run --args='help'
```

Commandes disponibles :

- `details` : smoke test historique autour de `HikeRepository`
- `generate` : produit une intervention à partir d'une position GPS
- `route-pois` : découvre et trie les POI le long d'un GPX
- `route-enrich` : enrichit un GPX avec waypoints audio et fichiers audio associés

## Tests du module

```bash
./gradlew :hikecore:test
```

Le module contient des tests sur :

- le ranking de POI
- la construction de prompts
- l'appel OpenAI encapsulé
- l'analyse GPX
- la découverte et l'enrichissement de POI de parcours
- les enums/presets TTS

## Commande `generate`

`generate` cherche des POI autour d'un point, enrichit les meilleurs candidats, construit un prompt puis appelle OpenAI pour produire une intervention textuelle. Avec `--with-audio`, la commande ajoute une synthèse audio Mistral.

Le niveau de détail utilisé par `generate` vient du fichier de préférences JSON chargé via `--prefs-file`. Il n'existe pas encore d'override CLI dédié pour ce flux ; pour changer de mode, il faut donc modifier `intervention_detail_level` et `poi_selection_mode` dans le fichier de préférences.

Exemple minimal :

```bash
./gradlew :hikecore:run --args='generate --lat 47.21268 --lon -1.56369 --radius 100 --prompt-file examples/prompt.txt --prefs-file examples/preferences.json'
```

Exemple avec audio :

```bash
./gradlew :hikecore:run --args='generate --lat 47.21268 --lon -1.56369 --radius 100 --prompt-file examples/prompt.txt --prefs-file examples/preferences.json --with-audio'
```

Options principales :

- `--lat <value>`
- `--lon <value>`
- `--radius <value>`
- `--prompt-file <path>`
- `--prefs-file <path>`
- `--lang <value>` ou `--voice <slug>` : utiliser l'un ou l'autre, pas les deux
- `--max-candidate-pois <value>`
- `--with-audio`

Sortie :

- JSON affiché sur stdout
- texte généré, modèle utilisé, candidats retenus
- `audioBase64` si `--with-audio`

## Commande `route-pois`

`route-pois` prend un GPX, construit un corridor autour du tracé, interroge Overpass par fenêtres, enrichit les meilleurs candidats puis applique une politique de densité pour obtenir une liste curée et ordonnée le long du parcours.

Le scoring combine :

- un score déterministe local
- un mode de sélection optionnel (`balanced`, `nature`, `history`, `architecture`, `panorama`)
- un reranking LLM optionnel, enrichi avec l'identité exacte du POI, ses `sourceRefs`, ses coordonnées et des extraits de sources

Exemple simple :

```bash
./gradlew :hikecore:run --args='route-pois --gpx-file samples/nantes-graslin-commerce.gpx'
```

Exemple déterministe, sans reranking LLM :

```bash
./gradlew :hikecore:run --args='route-pois --gpx-file samples/nantes-graslin-commerce.gpx --disable-llm-scoring'
```

Exemple avec filtre de catégories :

```bash
./gradlew :hikecore:run --args='route-pois --gpx-file samples/nantes-graslin-commerce.gpx --poi-categories historic,viewpoint --disable-llm-scoring'
```

Options principales :

- `--gpx-file <path>` : GPX à analyser
- `--lang <value>` : locale utilisée pour l'enrichissement
- `--max-pois-per-km <value>` : densité maximale sur une fenêtre glissante de 1 km
- `--route-buffer <value>` : largeur du corridor autour du tracé, en mètres
- `--poi-categories <list>` : filtre strict sur les catégories autorisées
- `--poi-selection-mode <value>` : preset pour biaiser la sélection
- `--detail-level <value>` : `short`, `balanced`, `detailed`
- `--disable-llm-scoring` : désactive le reranking LLM

Valeurs acceptées pour `--poi-categories` :

- `viewpoint`
- `peak`
- `waterfall`
- `cave`
- `historic`
- `attraction`
- `information`
- `all`
- `none`

Sortie :

- longueur du parcours
- POI retenus, triés par position sur le trajet
- waypoints déjà présents dans le GPX

## Commande `route-enrich`

`route-enrich` sélectionne les POI pertinents le long d'un GPX, génère un texte et un fichier audio pour chacun, écrit les fichiers audio dans un cache local puis produit un GPX enrichi avec des `wpt` nommés `hb_at_<uuid>_<lat>_<lon>`.

Dans ce flux, les coordonnées écrites dans les waypoints générés correspondent désormais au point le plus proche sur le tracé, pour obtenir un déclenchement audio plus régulier pendant le guidage, même si le POI réel est légèrement décalé du chemin.

Le niveau de détail influence deux choses à la fois :

- la quantité et la variété du contexte injecté au LLM
- la longueur cible de l'intervention finale

Règles actuelles du prompt :

- `SHORT` : 1 à 2 phrases, environ 35 mots max
- `BALANCED` : 2 à 3 phrases, environ 70 mots max
- `DETAILED` : 3 à 5 phrases, environ 120 mots max

Exemple simple :

```bash
./gradlew :hikecore:run --args='route-enrich --gpx-file samples/nantes-graslin-commerce.gpx'
```

Exemple avec chemins de sortie explicites :

```bash
./gradlew :hikecore:run --args='route-enrich --gpx-file samples/nantes-graslin-commerce.gpx --audio-cache-dir output/route-audio --output-gpx-file output/nantes-graslin-commerce.enriched.gpx'
```

Exemple avec affichage du GPX enrichi dans la sortie JSON :

```bash
./gradlew :hikecore:run --args='route-enrich --gpx-file samples/nantes-graslin-commerce.gpx --print-gpx'
```

Options principales :

- `--gpx-file <path>` : GPX à enrichir
- `--prompt-file <path>` : prompt texte utilisé pour la génération
- `--prefs-file <path>` : préférences utilisateur JSON utilisées dans le prompt
- `--lang <value>` ou `--voice <slug>` : utiliser l'un ou l'autre, pas les deux
- `--poi-categories <list>` : filtre strict sur les catégories autorisées
- `--poi-selection-mode <value>` : override du preset métier
- `--detail-level <value>` : override du niveau de détail
- `--audio-cache-dir <path>` : dossier de sortie des fichiers audio
- `--output-gpx-file <path>` : chemin du GPX enrichi
- `--print-gpx` : inclut le XML du GPX enrichi dans la sortie JSON

Sortie :

- chemin du GPX enrichi
- dossier du cache audio
- liste des waypoints générés
- liste des fichiers audio réellement produits

Par défaut :

- le GPX enrichi est écrit à côté du GPX source avec le suffixe `.enriched.gpx`
- les fichiers audio vont dans `output/route-audio`

## Tâche `ttsGenerate`

Cette tâche sert surtout à générer localement des échantillons de voix et de presets.

Exemples :

```bash
./gradlew :hikecore:ttsGenerate
./gradlew :hikecore:ttsGenerate --args="--voice jessica --preset playful-child --provider mistral"
./gradlew :hikecore:ttsGenerate --args="--batch --voice jessica --provider mistral"
```

Providers disponibles :

- `mistral` (défaut)

Voix disponibles :

- `Chris`
- `Adam`
- `Jessica`

Le résultat est écrit dans `hikecore/output/`.

## Fichiers d'exemple utiles

- [`samples/nantes-graslin-commerce.gpx`](../samples/nantes-graslin-commerce.gpx)
- [`hikecore/examples/prompt.txt`](examples/prompt.txt)
- [`hikecore/examples/preferences.json`](examples/preferences.json)

## Limites connues

- la plupart des pipelines réels dépendent du réseau
- le mode `details` reste un smoke test historique autour de `HikeRepository`
- le format de waypoint `hb_at_<uuid>_<lat>_<lon>` est aujourd'hui aussi le contrat utilisé par le prototype Android pour relier TTS intercepté et lecture audio
- même en `DETAILED`, les sources restent strictement exactes et bornées ; l'objectif est d'ajouter de la matière utile, pas de dériver vers une narration encyclopédique
