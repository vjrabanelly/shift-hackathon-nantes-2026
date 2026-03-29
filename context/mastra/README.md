# shift26-blindspot-mastra

## Getting Started

```shell
npm run dev
```

Studio UI → [http://localhost:4111](http://localhost:4111)  
Swagger UI → [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui)

---

## Workflows API

Base URL: `http://localhost:4111/api`

All article workflows share the same request body:

```json
{
    "inputData": {
        "source": "Le Monde",
        "title": "Titre de l'article",
        "authors": ["Prénom Nom"],
        "sections": [
            {
                "heading": "Sous-titre optionnel",
                "paragraphs": ["Paragraphe 1", "Paragraphe 2"]
            }
        ]
    }
}
```

### Individual workflows (fire in parallel from the frontend)

| Workflow         | Endpoint                                          | Output                                  | Speed         |
| ---------------- | ------------------------------------------------- | --------------------------------------- | ------------- |
| Mots-clefs       | `POST /workflows/keywords-extraction/start-async` | `{ keywords: string[] }`                | ⚡ rapide     |
| Résumé           | `POST /workflows/article-summary/start-async`     | `{ summary: string }`                   | ⚡ rapide     |
| Entités          | `POST /workflows/entities-analysis/start-async`   | `{ entities: [...] }`                   | ⚡ rapide     |
| Angles manquants | `POST /workflows/blindspots-analysis/start-async` | `{ blindspots: string[] }`              | ⚡ rapide     |
| Analyse du média | `POST /workflows/media-research/start-async`      | `{ mediaName, description, conflicts }` | 🐢 web search |
| Autres médias    | `POST /workflows/other-media/start-async`         | `{ otherMedia: [...] }`                 | 🐢 web search |

### Monolithic workflow (toutes les étapes en séquence)

```
POST /workflows/article-analysis/start-async
```

---

### Exemples `curl`

**Lancer tous les workflows rapides en parallèle :**

```bash
# Keywords
curl -X POST http://localhost:4111/api/workflows/keywords-extraction/start-async \
  -H "Content-Type: application/json" \
  -d '{"inputData":{"source":"Le Monde","title":"Mon article","authors":["Jean Dupont"],"sections":[{"paragraphs":["Contenu..."]}]}}'

# Résumé
curl -X POST http://localhost:4111/api/workflows/article-summary/start-async \
  -H "Content-Type: application/json" \
  -d '{"inputData":{"source":"Le Monde","title":"Mon article","authors":["Jean Dupont"],"sections":[{"paragraphs":["Contenu..."]}]}}'
```

**Réponse (`status: "success"`) :**

```json
{
  "status": "success",
  "result": { "keywords": ["IA", "régulation", "Europe"] },
  "steps": { ... },
  "input": { ... }
}
```

**Streamer l'exécution (SSE) :**

```bash
# 1. Créer un run pour obtenir un runId
RUN_ID=$(curl -s -X POST http://localhost:4111/api/workflows/keywords-extraction/create-run \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.runId')

# 2. Streamer
curl -X POST "http://localhost:4111/api/workflows/keywords-extraction/stream?runId=$RUN_ID" \
  -H "Content-Type: application/json" \
  -d '{"inputData":{"source":"Le Monde","title":"Mon article","authors":[],"sections":[{"paragraphs":["Contenu..."]}]}}'
```
