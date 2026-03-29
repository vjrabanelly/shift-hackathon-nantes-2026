# Backend Design — DreamJob

## Overview

DreamJob helps users tailor their resume to LinkedIn job posts. This document describes the backend architecture for the single-user, open-source demo.

**Goals:** minimal setup friction (`git clone && npm install && npm run dev`), no authentication, local-first.

---

## Stack

| Layer      | Choice                  | Why                                         |
| ---------- | ----------------------- | ------------------------------------------- |
| Runtime    | Node.js + TypeScript    | Widely known, great tooling                 |
| Framework  | Fastify                 | Fast, plugin-based, first-class TS support  |
| Database   | SQLite via Prisma       | Zero config — single file, no server needed |
| AI         | Claude API + OpenAI API | Abstraction layer, user picks via env var   |

---

## Data Models

All models use auto-increment integer IDs and `createdAt`/`updatedAt` timestamps.

### Profile

Single master record representing the user's complete professional identity.

| Field     | Type   | Notes                    |
| --------- | ------ | ------------------------ |
| id        | Int    | Always 1 (single user)   |
| name      | String |                          |
| email     | String |                          |
| phone     | String | Optional                 |
| location  | String | City, State / Remote     |
| summary   | String | Professional summary     |
| linkedin  | String | LinkedIn profile URL     |
| github    | String | GitHub profile URL       |
| website   | String | Personal website URL     |

### Experience

| Field       | Type     | Notes                          |
| ----------- | -------- | ------------------------------ |
| id          | Int      |                                |
| profileId   | Int      | FK → Profile                   |
| title       | String   | Job title                      |
| company     | String   |                                |
| location    | String   | Optional                       |
| startDate   | DateTime |                                |
| endDate     | DateTime | Null = current                 |
| description | String   | Role description               |
| highlights  | String[] | Key accomplishments (JSON col) |

### Education

| Field       | Type     | Notes          |
| ----------- | -------- | -------------- |
| id          | Int      |                |
| profileId   | Int      | FK → Profile   |
| institution | String   |                |
| degree      | String   | e.g. B.S., MBA |
| field       | String   | Field of study |
| startDate   | DateTime |                |
| endDate     | DateTime | Optional       |
| gpa         | Float    | Optional       |

### Skill

| Field       | Type   | Notes                              |
| ----------- | ------ | ---------------------------------- |
| id          | Int    |                                    |
| profileId   | Int    | FK → Profile                       |
| name        | String | e.g. "TypeScript"                  |
| category    | String | e.g. "Language", "Framework", "Tool" |
| proficiency | String | Optional: beginner/intermediate/advanced/expert |

### Achievement

| Field       | Type     | Notes        |
| ----------- | -------- | ------------ |
| id          | Int      |              |
| profileId   | Int      | FK → Profile |
| title       | String   |              |
| description | String   |              |
| date        | DateTime | Optional     |

### Project

| Field        | Type     | Notes                   |
| ------------ | -------- | ----------------------- |
| id           | Int      |                         |
| profileId    | Int      | FK → Profile            |
| name         | String   |                         |
| description  | String   |                         |
| url          | String   | Live demo or repo link  |
| technologies | String[] | Tech used (JSON col)    |

### Reference

| Field        | Type   | Notes                      |
| ------------ | ------ | -------------------------- |
| id           | Int    |                            |
| profileId    | Int    | FK → Profile               |
| name         | String |                            |
| title        | String | Their job title            |
| company      | String |                            |
| email        | String | Optional                   |
| phone        | String | Optional                   |
| relationship | String | e.g. "Former Manager"      |

### JobPost

Saved LinkedIn job posts the user wants to tailor their resume for.

| Field           | Type     | Notes                                  |
| --------------- | -------- | -------------------------------------- |
| id              | Int      |                                        |
| profileId       | Int      | FK → Profile                           |
| title           | String   | Job title                              |
| company         | String   |                                        |
| description     | String   | Full job description text              |
| url             | String   | LinkedIn post URL                      |
| salary          | String   | Optional, as posted                    |
| location        | String   |                                        |
| contractType    | String   | full-time / part-time / contract / internship |
| experienceLevel | String   | entry / mid / senior / lead / executive |
| postedDate      | DateTime | Optional                               |

### TailoredResume

Generated output from the AI tailoring process.

| Field     | Type     | Notes                       |
| --------- | -------- | --------------------------- |
| id        | Int      |                             |
| profileId | Int      | FK → Profile                |
| jobPostId | Int      | FK → JobPost                |
| content   | String   | The tailored resume content |
| format    | String   | "markdown" or "json"        |
| provider  | String   | Which AI generated it       |

---

## API Routes

Base path: `/api`

### Profile

| Method | Route                            | Description                    |
| ------ | -------------------------------- | ------------------------------ |
| GET    | `/api/profile`                   | Get the user profile           |
| PUT    | `/api/profile`                   | Update the user profile        |

### Profile Sub-resources

Each sub-resource follows the same CRUD pattern:

| Method | Route                            | Description          |
| ------ | -------------------------------- | -------------------- |
| GET    | `/api/profile/{resource}`        | List all             |
| POST   | `/api/profile/{resource}`        | Create one           |
| GET    | `/api/profile/{resource}/:id`    | Get one              |
| PUT    | `/api/profile/{resource}/:id`    | Update one           |
| DELETE | `/api/profile/{resource}/:id`    | Delete one           |

Where `{resource}` is one of: `experiences`, `educations`, `skills`, `achievements`, `projects`, `references`.

### Job Posts

| Method | Route             | Description            |
| ------ | ----------------- | ---------------------- |
| GET    | `/api/jobs`       | List saved job posts   |
| POST   | `/api/jobs`       | Save a new job post    |
| GET    | `/api/jobs/:id`   | Get a job post         |
| PUT    | `/api/jobs/:id`   | Update a job post      |
| DELETE | `/api/jobs/:id`   | Delete a job post      |

### Tailoring

| Method | Route                      | Description                        |
| ------ | -------------------------- | ---------------------------------- |
| POST   | `/api/tailor`              | Generate a tailored resume         |
| GET    | `/api/tailored-resumes`    | List all tailored resumes          |
| GET    | `/api/tailored-resumes/:id`| Get a specific tailored resume     |
| DELETE | `/api/tailored-resumes/:id`| Delete a tailored resume           |

**POST `/api/tailor` request body:**

```json
{
  "jobPostId": 1,
  "provider": "claude",
  "format": "markdown"
}
```

The endpoint fetches the full profile + job post, sends them to the selected AI provider, and stores the result as a TailoredResume.

---

## Validation

Fastify has built-in request validation via JSON Schema. Each route defines a schema for its request body and params, and Fastify rejects invalid requests with a `400` before the handler runs.

### Approach

- Define schemas with `@sinclair/typebox` (ships with Fastify) for type-safe schema + TypeScript type from a single definition.
- Schemas live alongside their routes (co-located in each route file).
- Only validate at the API boundary — no redundant checks inside services.

### What to validate

| Area         | Rules                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Required fields | Reject missing required fields (e.g. Profile `name`, `email`)     |
| Types        | Strings are strings, numbers are numbers, dates are ISO-8601 strings  |
| Enums        | `contractType`, `experienceLevel`, `proficiency`, `format`, `provider` must be one of the allowed values |
| String limits | Reasonable max lengths (e.g. `name` ≤ 200, `description` ≤ 10000)   |
| ID params    | Route `:id` params must be positive integers                          |

### Error format

Fastify's default validation error response:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/email must match format \"email\""
}
```

No custom error handler needed — the default format is clear enough for a demo.

---

## AI Abstraction Layer

```
services/ai/
  index.ts    — AIProvider interface + getProvider() factory
  claude.ts   — Claude implementation (Anthropic SDK)
  openai.ts   — OpenAI implementation (OpenAI SDK)
```

### Interface

```typescript
interface AIProvider {
  tailorResume(profile: FullProfile, jobPost: JobPost): Promise<string>;
}
```

### Provider Selection

- `AI_PROVIDER` env var: `"claude"` (default) or `"openai"`
- `ANTHROPIC_API_KEY` — required when using Claude
- `OPENAI_API_KEY` — required when using OpenAI

The factory function reads `AI_PROVIDER` and returns the corresponding implementation. The tailoring prompt is shared across providers — only the API call differs.

---

## Project Structure

```
src/
  server.ts              — Fastify app setup, plugin registration
  routes/
    profile.ts           — Profile + sub-resource CRUD
    jobs.ts              — Job post CRUD
    tailor.ts            — Tailoring endpoints
  services/
    ai/
      index.ts           — Provider interface + factory
      claude.ts          — Claude implementation
      openai.ts          — OpenAI implementation
    tailor.ts            — Orchestrates profile fetch + AI call + save
prisma/
  schema.prisma          — All data models
  seed.ts                — Demo profile data
.env.example             — Template with required env vars
package.json
tsconfig.json
```

---

## Setup & Configuration

### Environment Variables

```env
# Required — at least one AI key
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional
AI_PROVIDER=claude          # "claude" or "openai" (default: claude)
PORT=3000                   # Server port (default: 3000)
DATABASE_URL=file:./dev.db  # SQLite path (default: file:./dev.db)
```

### Getting Started

```bash
git clone <repo-url>
cd dreamjob
cp .env.example .env       # Add your API key(s)
npm install
npx prisma db push          # Create SQLite DB + tables
npx prisma db seed           # Load demo profile data
npm run dev                  # Start Fastify on :3000
```

### Scripts

| Script          | Command                | Purpose                    |
| --------------- | ---------------------- | -------------------------- |
| `dev`           | `tsx watch src/server.ts` | Dev server with hot reload |
| `build`         | `tsc`                  | Compile TypeScript         |
| `start`         | `node dist/server.js`  | Production start           |
| `db:push`       | `prisma db push`       | Sync schema to DB          |
| `db:seed`       | `prisma db seed`       | Seed demo data             |
| `db:studio`     | `prisma studio`        | Visual DB browser          |

---

## Seed Data

The seed script creates a single demo profile with:
- Basic info (name, contact, links)
- 2-3 work experiences with highlights
- 1-2 education entries
- 8-10 skills across categories
- 2-3 achievements
- 2-3 portfolio projects
- 1-2 references

This lets users immediately try the tailoring feature without manual data entry.
