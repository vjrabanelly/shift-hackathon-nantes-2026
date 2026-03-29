# Clever Cloud deployment

This repo deploys to Clever Cloud as two Docker applications from the same git repository:

- `app-partyjam-essentia` from `apps/essentia/Dockerfile`
- `app-partyjam-api` from `apps/api/Dockerfile`

The API image also builds the Vite frontend and serves it from Fastify, so there is no separate web app to deploy.

Because Clever Cloud builds these Docker apps from the repository root, Dockerfiles under `apps/` must use root-relative `COPY` paths such as `COPY apps/essentia/...`.

## Prerequisites

Install and log into Clever Tools:

```bash
npm install -g clever-tools
clever login
```

The deploy script also expects:

- a git repository with at least one commit
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

You can keep these values in the repo root `.env`, or export them in your shell before running the script.

## Deploy

From the repository root:

```bash
bash ./scripts/deploy-clever-cloud.sh
```

Useful overrides:

```bash
CLEVER_ORG=my-org \
CLEVER_REGION=par \
API_APP_NAME=app-partyjam-api \
ESSENTIA_APP_NAME=app-partyjam-essentia \
API_PUBLIC_URL=https://your-real-api-domain.cleverapps.io \
ESSENTIA_PUBLIC_URL=https://your-real-essentia-domain.cleverapps.io \
bash ./scripts/deploy-clever-cloud.sh
```

If you do not set `API_PUBLIC_URL` or `ESSENTIA_PUBLIC_URL`, the script will ask Clever Cloud for the real assigned `cleverapps.io` domain and use that automatically.

## What the script configures

For both apps it:

- creates or links a local Clever alias
- sets `CC_DOCKERFILE`
- sets `CC_HEALTH_CHECK_PATH=/health`
- deploys the current git commit with `clever deploy --same-commit-policy rebuild`

For the API app it also sets:

- `ESSENTIA_URL` to the Essentia public URL
- `BASE_URL` and `VITE_API_URL` to the API public URL
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Optional pass-through variables:

- `OPENAI_API_KEY`
- `LASTFM_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PARTYJAM_MEDIA_ROOT`
- `STREAM_BASE_URL`

## Important note

Clever Cloud deployments are git-based. If your working tree is dirty, the script warns you, but only committed changes are actually deployed.
