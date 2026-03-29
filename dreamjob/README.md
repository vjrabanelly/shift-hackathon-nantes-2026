curl -X POST http://localhost:3000/api/cvs/generate -H "Content-Type: application/json" -d '{"jobPostId": "job_01", "language": "fr"}'

# dreamjob

LinkedIn-style hackathon prototype for AI-assisted job applications.

## Repo layout

- `backend-design.md`: backend schema and route design.
- `extension-ui/`: Chrome MV3 UI scaffold for the demo.
- `SPRINT-1-PLAN.md`: 1.5-day sprint plan for the frontend flow.

## UI focus

The extension UI is built around a side panel flow:

- master resume
- selected offer
- application dashboard
- interview preparation

The current scaffold is mock-first and shaped to connect later to the backend routes defined in `backend-design.md`.

## Protocole installation

Need :

- chrome
- the repo github

go into the folder `extension-ui`
Inside the folder you have to make the installations of the dependencies `npm i`
Once you have done all the installations build the extension `npm run build`

Load Chrome
In Chrome go to `chrome://extensions`
active the `dev-mode` (en haut à droite)
Click on `Load unpack`
find the correct folder inside `extension-ui\dists` Load it.
once you have it you have to re-load chrome and it should work

## Lancer en local

**Backend** (depuis la racine du repo) :

```bash
npm i
npm run dev       # Fastify avec hot reload (tsx watch)
npm run seed      # Charger les donnees de test
```

**Extension UI** (depuis `extension-ui/`) :

```bash
cd extension-ui
npm i
npm run dev       # Serveur Vite
npm run build     # Build pour charger dans Chrome
```

Les deux serveurs tournent sur des ports differents et peuvent etre lances en parallele sans conflit.

## Endpoints API

> Pour les contrats complets, voir `backend-design.md` et `src/schemas/`.

### Profil

| Methode | Route          | Description                     |
| ------- | -------------- | ------------------------------- |
| `GET`   | `/api/profile` | Recuperer le profil utilisateur |
| `PUT`   | `/api/profile` | Remplacer le profil complet     |

**`PUT /api/profile`** — Corps de la requete :

```jsonc
{
  "id": "string",                // identifiant du profil
  "data": ProfileData,           // voir Objets de donnees cles
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

### CV (upload & extraction)

| Methode | Route                            | Description                             |
| ------- | -------------------------------- | --------------------------------------- |
| `POST`  | `/api/resume/upload`             | Uploader un PDF (multipart, max 10 Mo)  |
| `GET`   | `/api/resume/status`             | Statut de l'upload                      |
| `GET`   | `/api/resume/extraction`         | Donnees extraites + scores de confiance |
| `POST`  | `/api/resume/extraction/confirm` | Confirmer l'extraction vers le profil   |
| `PUT`   | `/api/resume/extraction/review`  | Marquer une section comme relue         |
| `GET`   | `/api/resume/completeness`       | Progression, score, checklist           |

**`POST /api/resume/upload`** — Multipart form-data, un seul fichier PDF (`application/pdf`), max 10 Mo.

**`PUT /api/resume/extraction/review`** — Corps de la requete :

```jsonc
{
  "section": "string", // "identity" | "targetRoles" | "professionalSummaryMaster" | "constraints" | "experiences" | "education" | "skills" | "certifications" | "languages" | "projects" | "references"
  "itemId": "string", // (optionnel) requis pour les sections de type tableau
  "reviewed": true, // boolean
}
```

### Offres d'emploi (brutes)

| Methode | Route               | Description                           |
| ------- | ------------------- | ------------------------------------- |
| `POST`  | `/api/jobs/raw`     | Capturer une offre depuis l'extension |
| `GET`   | `/api/jobs/raw`     | Lister toutes les captures brutes     |
| `GET`   | `/api/jobs/raw/:id` | Recuperer une capture par ID          |
| `GET`   | `/api/jobs/current` | Recuperer la derniere offre capturee  |

**`POST /api/jobs/raw`** — Corps de la requete :

```jsonc
{
  "source": "string", // (requis) source de l'offre
  "sourceUrl": "string", // (requis) URL de la source
  "rawText": "string", // (requis) texte brut de l'offre
  "htmlSnapshotRef": "string", // (optionnel) reference au snapshot HTML
  "rawFields": {
    // (optionnel) champs structures
    "title": "string",
    "company": "string",
    "location": "string",
    "employment_type": "string",
    "salary": "string",
    "description": "string",
    "requirements": "string",
    "posted_date": "string",
  },
}
```

**`GET /api/jobs/raw/:id`** — Parametre de route : `id` (string).

### Offres d'emploi (normalisees)

| Methode  | Route           | Description                          |
| -------- | --------------- | ------------------------------------ |
| `GET`    | `/api/jobs`     | Lister toutes les offres normalisees |
| `GET`    | `/api/jobs/:id` | Recuperer une offre par ID           |
| `PUT`    | `/api/jobs/:id` | Modifier une offre                   |
| `DELETE` | `/api/jobs/:id` | Supprimer une offre                  |

**`GET /api/jobs/:id`**, **`PUT /api/jobs/:id`**, **`DELETE /api/jobs/:id`** — Parametre de route : `id` (string).

**`PUT /api/jobs/:id`** — Corps de la requete (tous les champs sont optionnels) :

```jsonc
{
  "title": "string", // max 200 car.
  "company": "string", // max 200 car.
  "description": "string", // max 10 000 car.
  "url": "string",
  "salary": "string",
  "location": "string", // max 200 car.
  "remoteMode": "onsite | hybrid | remote",
  "employmentType": "full_time | part_time | contract | internship",
  "seniority": "entry | mid | senior | lead | executive",
  "jobSummary": "string", // max 10 000 car.
  "responsibilities": ["string"],
  "requirementsMustHave": ["string"],
  "requirementsNiceToHave": ["string"],
  "keywords": ["string"],
  "tools": ["string"],
  "languages": ["string"],
  "yearsExperienceMin": 0, // nombre
  "postedDate": "string",
}
```

### CV generes & reviews

| Methode  | Route                           | Description                  |
| -------- | ------------------------------- | ---------------------------- |
| `POST`   | `/api/cvs/generate`             | Lancer la generation d'un CV |
| `GET`    | `/api/cvs`                      | Lister tous les CV generes   |
| `GET`    | `/api/cvs/:id`                  | Recuperer un CV              |
| `GET`    | `/api/cvs/:id/pdf`              | Exporter un CV en PDF        |
| `DELETE` | `/api/cvs/:id`                  | Supprimer un CV              |
| `GET`    | `/api/cvs/:id/ats-review`       | Review ATS du CV             |
| `GET`    | `/api/cvs/:id/recruiter-review` | Review recruteur du CV       |

**`POST /api/cvs/generate`** — Corps de la requete :

```jsonc
{
  "jobPostId": "string", // (requis) ID de l'offre ciblee
  "language": "string", // (requis) langue du CV genere
}
```

**`GET /api/cvs/:id`**, **`DELETE /api/cvs/:id`**, **`GET /api/cvs/:id/ats-review`**, **`GET /api/cvs/:id/recruiter-review`** — Parametre de route : `id` (string).

## Objets de donnees cles

| Objet               | Champs principaux                                                                                                     | Role                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **ProfileData**     | `identity`, `experiences[]`, `education[]`, `skills[]`, `targetRoles[]`, `constraints`                                | Identite professionnelle de l'utilisateur   |
| **JobOfferRaw**     | `source`, `sourceUrl`, `rawText`, `rawFields`                                                                         | Capture brute depuis l'extension navigateur |
| **JobPost**         | `title`, `company`, `location`, `remoteMode`, `seniority`, `employmentType`, `requirements*`, `keywords[]`, `tools[]` | Offre normalisee par l'IA                   |
| **GeneratedCV**     | `header`, `summary`, `skillsHighlighted[]`, `experiencesSelected[]`, `keywordsCovered[]`, `coverageMap`               | CV cible genere pour une offre              |
| **ATSReview**       | `score`, `passed`, `matchedKeywords[]`, `missingKeywords[]`, `recommendations[]`                                      | Evaluation ATS automatique                  |
| **RecruiterReview** | `score`, `passed`, `readabilityScore`, `credibilityScore`, `strengths[]`, `concerns[]`                                | Evaluation recruteur simulee                |
| **AddonResult**     | `status`, `overall_score`, `scores`, `strengths[]`, `weaknesses[]`, `recommendations[]`                               | Reponse finale renvoyee a l'extension       |

## Enums

| Enum             | Valeurs                                            |
| ---------------- | -------------------------------------------------- |
| `remoteMode`     | `onsite`, `hybrid`, `remote`                       |
| `employmentType` | `full_time`, `part_time`, `contract`, `internship` |
| `seniority`      | `entry`, `mid`, `senior`, `lead`, `executive`      |
| `finalStatus`    | `FINAL_APPROVED`, `REJECTED`, `NEEDS_REVISION`     |

## Usages

### When you send the job, the response is the normalized version...

```sh
# -> return jobs-raw-response.json

curl -X POST http://localhost:3000/api/jobs/raw \
  -H "Content-Type: application/json" \
  -d '{
    "source": "manual-test",
    "sourceUrl": "https://example.com/jobs/senior-backend-typescript",
    "rawText": "Senior Backend Engineer. Company: DreamCorp. Location: Paris hybrid. We are looking for 5+ years of experience in Node.js, TypeScript, REST APIs, PostgreSQL, Docker, AWS, and system design. You will collaborate with product and frontend teams, build scalable backend services, improve API performance, and maintain CI/CD pipelines. Nice to have: Kubernetes, Terraform, mentoring experience, and fintech domain knowledge. English required.",
    "rawFields": {
      "title": "Senior Backend Engineer",
      "company": "DreamCorp",
      "location": "Paris / Hybrid",
      "employment_type": "full_time",
      "description": "Build scalable backend services in Node.js and TypeScript with PostgreSQL, Docker, AWS and CI/CD.",
      "requirements": "5+ years Node.js/TypeScript, PostgreSQL, Docker, AWS, REST APIs, system design",
      "posted_date": "2026-03-28"
    }
  }' | tee jobs-raw-response.json
```

## 2) Generate CV

-> return cv + ats + recruiter review

```sh
# -> return cv-generate-response.json

curl -X PUT http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "id": "profile_01",
    "createdAt": "2026-03-29T10:00:00.000Z",
    "updatedAt": "2026-03-29T10:00:00.000Z",
    "data": {
      "identity": {
        "name": "Jean Dupont",
        "headline": "Senior Backend Engineer",
        "email": "jean.dupont@example.com",
        "phone": "+33 6 12 34 56 78",
        "location": "Paris, France"
      },
      "targetRoles": ["Senior Backend Engineer"],
      "professionalSummaryMaster": "Ingenieur backend avec experience en Node.js, TypeScript, PostgreSQL et AWS.",
      "experiences": [
        {
          "experienceId": "exp_01",
          "title": "Backend Engineer",
          "company": "TechCorp",
          "location": "Paris",
          "startDate": "2021-01",
          "endDate": "2024-12",
          "description": "Developpement de services backend",
          "achievements": [
            {
              "text": "Developpement et maintenance d APIs REST",
              "metric": "30% improvement",
              "proofLevel": "high"
            }
          ],
          "skillsUsed": ["Node.js", "TypeScript", "PostgreSQL", "Docker", "AWS", "REST API"]
        }
      ],
      "education": [
        {
          "school": "EPITA",
          "degree": "Master",
          "field": "Informatique",
          "year": 2018
        }
      ],
      "skills": [
        { "name": "Node.js", "years": 6 },
        { "name": "TypeScript", "years": 5 },
        { "name": "PostgreSQL", "years": 4 },
        { "name": "Docker", "years": 4 },
        { "name": "AWS", "years": 3 }
      ],
      "certifications": [],
      "languages": [
        { "name": "Francais", "level": "natif" },
        { "name": "Anglais", "level": "professionnel" }
      ],
      "projects": [],
      "references": [],
      "constraints": {
        "preferredCvLanguage": "fr",
        "maxCvPages": 2,
        "mustNotClaim": []
      }
    }
  }' | python -m json.tool | tee profile-response.json

curl -s -X POST http://localhost:3000/api/cvs/generate \
  -H "Content-Type: application/json" \
  -d '{"jobPostId":"job_02","language":"fr"}' \
  | python -m json.tool | tee cv-generate-response.json

```

## 3) Export generated CV to PDF

-> return a minimal PDF generated from the stored CV JSON

1. Open `cv-generate-response.json` and copy the generated CV id:

```json
{
  "cv": {
    "id": "cv_xxxxxxxx"
  }
}
```

2. Download the PDF:

```sh
curl -o mon-cv.pdf http://localhost:3000/api/cvs/<CV_ID>/pdf
```

Example:

```sh
curl -o mon-cv.pdf http://localhost:3000/api/cvs/cv_ab12cd34/pdf
```

3. The backend also stores a copy here:

```txt
data/exports/<CV_ID>.pdf
```

Notes:

- this export is intentionally simple and text-based
- if some fields are empty in `cv-generate-response.json`, they will also be sparse in the PDF
- if the route returns `{"error":"CV not found"}`, the `CV_ID` is incorrect
