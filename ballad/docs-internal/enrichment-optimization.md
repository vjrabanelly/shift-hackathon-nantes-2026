# Optimisation du pipeline d'enrichissement GPX

## Objectif

Passer le temps d'enrichissement d'un parcours GPX de **~50 secondes a ~5 secondes**.

## Pipeline AVANT (séquentiel, ~50s)

```
t=0s     t=5-10s         t=10-20s         t=20-25s
  │         │                │                │
  ▼         ▼                ▼                ▼
┌─────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐
│Parse│─▶│   Overpass    │─▶│  Wikipedia/  │─▶│ Scoring  │
│ GPX │  │  POI query    │  │  Wikidata    │  │+ Ranking │
│~0ms │  │  N batches    │  │  séquentiel  │  │  ~0ms    │
└─────┘  │  séquentiels  │  │  par POI     │  └────┬─────┘
         └──────────────┘  └──────────────┘       │
                                                   ▼
         t=25-45s                    t=45-50s
            │                           │
            ▼                           ▼
         ┌──────────────────┐  ┌──────────────────┐
         │    OpenAI        │  │   Assemblage     │
         │  text gen        │  │   GPX final      │
         │  1 appel/POI     │──▶│                  │
         │  séquentiel      │  └──────────────────┘
         │  + Mistral TTS   │
         │  1 appel/POI     │
         │  séquentiel      │
         └──────────────────┘

Temps total : ~40-50 secondes
```

### Goulots identifiés

| Étape              | Temps actuel | Cause                                    |
|--------------------|-------------|------------------------------------------|
| Overpass           | 5-10s       | N batches de 3 fenêtres, séquentiels     |
| Wiki enrichment    | 5-10s       | Appels HTTP séquentiels par POI          |
| OpenAI text gen    | 8-20s       | 1 appel API par POI, séquentiel          |
| Mistral TTS        | 4-12s       | 1 appel API par POI, séquentiel          |

## Pipeline APRÈS (parallélisé + batché, ~5s)

```
t=0s                                                              t=5-6s
  │                                                                  │
  ▼                                                                  ▼
┌─────┐  ┌──────────────┐  ┌──────────────────┐  ┌───────────┐  ┌──────┐
│Parse│─▶│  Overpass     │─▶│ Wiki enrichment  │─▶│  OpenAI   │─▶│ TTS  │
│ GPX │  │  1 SEULE      │  │  PARALLÈLE       │  │  1 SEUL   │  │PARAL.│
│~0ms │  │  requête      │  │  par POI         │  │  appel    │  │      │
└─────┘  │  (bbox route) │  │  (coroutines)    │  │  (batch)  │  │      │
         └──────────────┘  └──────────────────┘  └───────────┘  └──────┘
          ~2s               ~1-2s                 ~2-3s          ~1-2s
```

### Détail du pipeline optimisé

```
t=0s   ┌─────────────────────────────────────────────────┐
       │ OVERPASS : 1 requête unique                     │
       │                                                 │
       │ Avant : windows.chunked(3).forEach { query() }  │
       │ Après : mergedBounds(ALL windows) → 1 query()   │
       │                                                 │
       │ Gain : N requêtes séquentielles → 1 requête     │
t=2s   └────────────────────┬────────────────────────────┘
                            │ POIs bruts
                            ▼
t=2s   ┌─────────────────────────────────────────────────┐
       │ WIKI ENRICHMENT : coroutineScope + async        │
       │                                                 │
       │ Avant : pois.map { enrich(it) }     (séquentiel)│
       │ Après : pois.map { async { enrich(it) } }      │
       │         .awaitAll()                  (parallèle) │
       │                                                 │
       │ Gain : N × 1-2s → max(1-2s)                    │
t=3s   └────────────────────┬────────────────────────────┘
                            │ POIs enrichis + scorés
                            ▼
t=3s   ┌─────────────────────────────────────────────────┐
       │ OPENAI BATCH : 1 prompt = N textes              │
       │                                                 │
       │ Avant : pois.forEach { llm.generate(it) }      │
       │ Après : llm.generateBatch(allContexts)          │
       │         → 1 appel, JSON array de N textes       │
       │                                                 │
       │ Nouveau schéma JSON :                           │
       │ { "interventions": [                            │
       │     { "poi_id": "...", "text": "..." },         │
       │     ...                                         │
       │ ] }                                             │
       │                                                 │
       │ Gain : N appels → 1 appel                       │
t=5s   └────────────────────┬────────────────────────────┘
                            │ N textes générés
                            ▼
t=5s   ┌─────────────────────────────────────────────────┐
       │ MISTRAL TTS : coroutineScope + async            │
       │                                                 │
       │ Avant : texts.forEach { tts.synthesize(it) }   │
       │ Après : texts.map { async { tts.synthesize(it) }│
       │         .awaitAll()                             │
       │                                                 │
       │ Gain : N × 1-3s → max(1-3s)                    │
t=6s   └────────────────────┬────────────────────────────┘
                            │
                            ▼ GPX enrichi + fichiers MP3

TOTAL : ~5-6 secondes (vs ~50s avant = gain ~10x)
```

## Les 4 leviers appliqués

### Levier 1 -- Overpass : 1 seule requête

**Fichier :** `RoutePoiDiscoveryService.kt` -- `discoverRawCandidates()`

Au lieu de découper les fenêtres en batches de 3 et de les requêter séquentiellement,
on fusionne la bounding box de toutes les fenêtres et on fait une unique requête Overpass.
La répartition par fenêtre se fait après coup lors de la projection sur le tracé.

### Levier 2 -- Wiki enrichment parallèle

**Fichier :** `RoutePoiDiscoveryService.kt` -- boucle d'enrichissement

Chaque POI est enrichi dans sa propre coroutine via `async { enrich(it) }`.
Tous les appels Wikipedia/Wikidata partent en même temps.

### Levier 3 -- OpenAI batch : disponible via `generateBatch()`

**Fichiers :**
- `Pipeline.kt` -- ajout de `generateBatch()` sur `LlmClient` (avec fallback séquentiel par défaut)
- `OpenAiResponsesLlmClient.kt` -- implémentation batch (1 prompt = N textes, JSON array)
- `CachedLlmClient.kt` -- support batch avec cache par POI

L'interface `generateBatch` est disponible pour les cas où la tolérance aux pannes
n'est pas nécessaire. Pour le pipeline d'enrichissement principal, les appels sont
faits en parallèle individuellement (levier 4) pour préserver le best-effort par POI.

### Levier 4 -- LLM + TTS parallèle par POI

**Fichier :** `GpxRouteEnrichmentService.kt`

Chaque POI est traité dans sa propre coroutine via `coroutineScope + async`.
Chaque coroutine fait : LLM generate → TTS synthesize → write MP3.
Un POI en échec n'invalide pas les autres (best-effort préservé).
Gain : N × (LLM + TTS) séquentiel → max(LLM + TTS) parallèle.

## Comparaison des temps

```
                    AVANT           APRÈS          GAIN
                    ─────           ─────          ────
Parse GPX           ~0ms            ~0ms           -
Overpass            5-10s           2-3s           ~3x
Wiki enrichment     5-10s           1-2s           ~5x
Scoring/Ranking     ~0ms            ~0ms           -
OpenAI text gen     8-20s           2-3s           ~5x
Mistral TTS         4-12s           1-2s           ~5x
                    ─────           ─────          ────
TOTAL               ~40-50s         ~5-6s          ~8-10x
```

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Overpass rate-limit sur grosse bbox | Fallback sur le mode batché si la requête unique échoue |
| OpenAI batch trop long (context window) | Limiter à ~8 POIs par batch, splitter si nécessaire |
| TTS parallèle → rate-limit Mistral | Limiter la concurrence à 4 coroutines simultanées |
| Cache invalidé par le batch | Le cache fonctionne par prompt, le batch a un cache séparé |
