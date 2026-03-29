# Jibe POC Backend

Backend Node.js + TypeScript pour le POC de generation de CV multi-agents decrit dans [SPEC_POC_MULTI_AGENT_CV.md](/c:/Users/devme/Desktop/dreamjob/jibe_poc/SPEC_POC_MULTI_AGENT_CV.md).

Le backend prend une offre d'emploi lue par un addon LinkedIn, charge un profil candidat depuis une base JSON, genere un CV cible, fait passer 2 reviews (`ATS` et `Recruteur`) puis retourne un resultat standardise a l'addon.

## Stack

- Node.js
- TypeScript
- Express
- OpenAI Responses API

## Prerequis

- Node.js 20+ recommande
- npm
- une cle OpenAI valide

## Installation

Depuis le dossier [jibe_poc](/c:/Users/devme/Desktop/dreamjob/jibe_poc) :

```bash
npm install
```

## Configuration

Copier le fichier `.env.example` en `.env`.

Exemple :

```env
PORT=3000
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL_CANDIDATE=gpt-5.4
OPENAI_MODEL_ATS=gpt-5-mini
OPENAI_MODEL_RECRUITER=gpt-5-mini
```

## Lancement

Demarrer le serveur en developpement :

```bash
npm run dev
```

Ou lancer la version compilee :

```bash
npm run build
npm start
```

Le serveur demarre par defaut sur :

```text
http://localhost:3000
```

## Verification rapide

### Healthcheck

```bash
curl http://localhost:3000/health
```

Reponse attendue :

```json
{
  "status": "ok"
}
```

### Test rapide de l'endpoint addon

Le candidat de demonstration fourni dans [data/candidates.json](/c:/Users/devme/Desktop/dreamjob/jibe_poc/data/candidates.json) est `cand_001`.

Exemple Bash :

```bash
curl -X POST http://localhost:3000/api/workflows/run \
  -H "Content-Type: application/json" \
  -d '{
    "jobOfferRaw": {
      "source": "linkedin",
      "source_url": "https://linkedin.com/jobs/view/456",
      "raw_text": "Product Designer senior. Entreprise : NovaTech. Paris. Hybride. Recherche 5 ans d'experience minimum, maitrise de Figma, design systems, collaboration avec les equipes produit et engineering, animation d'ateliers, bonne communication avec les parties prenantes. Un profil ayant deja travaille sur un produit SaaS B2B est un plus.",
      "raw_fields": {
        "title": "Product Designer senior",
        "company": "NovaTech",
        "location": "Paris",
        "employment_type": "Temps plein"
      }
    },
    "candidateId": "cand_001"
  }'

```

## Endpoints principaux

- `GET /health`
- `GET /api/models`
- `GET /api/candidates/:candidateId`
- `POST /api/job-offers/normalize`
- `POST /api/agents/candidate/run`
- `POST /api/agents/ats/run`
- `POST /api/agents/recruiter/run`
- `POST /api/workflows/run`
- `POST /api/addon/run`

## Endpoint principal pour l'addon

L'endpoint a appeler cote addon est :

```text
POST /api/addon/run
```

Input attendu :

```json
{
  "jobOfferRaw": {
    "source": "linkedin",
    "source_url": "https://linkedin.com/jobs/view/123",
    "raw_text": "full text from linkedin",
    "raw_fields": {
      "title": "Senior Product Designer",
      "company": "Acme",
      "location": "Paris",
      "employment_type": "Full-time"
    }
  },
  "candidateId": "cand_001"
}
```

Output :

- toujours un objet `AddonResult`
- `status` vaut `accepted` ou `rejected`
- le backend retourne aussi le score, les points forts, les points faibles et les recommandations
- un resultat complet formate est aussi ecrit automatiquement dans `generate_by_ai.json` a la racine de `jibe_poc` lors d'un appel a `POST /api/workflows/run` ou `POST /api/addon/run`

## Scripts npm

- `npm run dev` : demarre le serveur en mode developpement avec `tsx`
- `npm run build` : compile TypeScript vers `dist`
- `npm start` : lance la version compilee

## Structure utile

- [src/server.ts](/c:/Users/devme/Desktop/dreamjob/jibe_poc/src/server.ts) : serveur HTTP et routes
- [src/services/workflow-service.ts](/c:/Users/devme/Desktop/dreamjob/jibe_poc/src/services/workflow-service.ts) : orchestration globale
- [src/services/agents.ts](/c:/Users/devme/Desktop/dreamjob/jibe_poc/src/services/agents.ts) : agents `Candidat`, `ATS`, `Recruteur`
- [src/services/job-offer-normalizer.ts](/c:/Users/devme/Desktop/dreamjob/jibe_poc/src/services/job-offer-normalizer.ts) : normalisation de l'offre
- [data/candidates.json](/c:/Users/devme/Desktop/dreamjob/jibe_poc/data/candidates.json) : base master candidat de demo

## Notes

- Le stockage candidat est volontairement simple pour le POC : JSON local.
- Le dossier `dist/` contient la version compilee apres `npm run build`.

## Input de test pour s'amuser

```
curl -X POST http://localhost:3000/api/workflows/run \
  -H "Content-Type: application/json" \
  -d '{
    "jobOfferRaw": {
      "source": "linkedin",
      "source_url": "https://linkedin.com/jobs/view/103",
      "raw_text": "Detective prive. Entreprise : Aegis Investigation. Paris. Temps plein. Recherche un detective prive rigoureux et discret pour conduire des enquetes civiles et commerciales. Missions : collecte dinformations, filatures, recherches documentaires, redaction de rapports detailles, verification de fraude et collaboration avec les clients dans le respect du cadre legal. Une excellente capacite dobservation, une grande autonomie et une bonne maitrise des outils numeriques sont indispensables. Une experience en securite, investigation ou renseignement est appreciee.",
      "raw_fields": {
        "title": "Detective prive",
        "company": "Aegis Investigation",
        "location": "Paris",
        "employment_type": "Temps plein"
      }
    },
    "candidateId": "cand_001"
  }'
```
