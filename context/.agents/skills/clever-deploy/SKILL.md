---
name: clever-deploy
description: Use when working on this repository's deployment workflow, Justfile, Docker Compose setup, or environment configuration. Follow the project's Clever Cloud deployment conventions, use the root Justfile recipes when available, prefer the repository Docker Compose environment over ad hoc local npm installs, and update README.md whenever deployment commands, remotes, prerequisites, or environment expectations change.
---

# Clever Deploy

Use this skill when the task touches deployment, `Justfile`, or local setup documentation for this repository.

## Goals

- Keep deployment commands centralized in the root `Justfile`
- Prefer generic reusable recipes over copy-pasted shell commands
- Use the repository's `docker-compose.yml` as the default local runtime environment
- Avoid local `npm install` or ad hoc package setup unless the user explicitly asks for it
- Keep `README.md` in sync with deployment commands and prerequisites
- Preserve the current Clever Cloud naming conventions unless the user asks to change them

## Workflow

1. Read `Justfile` and `README.md` before making changes.
2. If a deployment command is added or changed, update the matching documentation in `README.md` in the same turn.
3. If a new service is added, prefer:
   - a generic deployment helper recipe
   - one service-specific recipe per service
   - an aggregate recipe such as `deploy`
4. Keep the default branch configurable, with `main` as the default unless the repository clearly uses something else.
5. Do not silently change branch targets, remotes, or force-push behavior without reflecting that change in the docs.
6. For local execution, prefer `docker compose` or `just` targets that wrap it, instead of running installation commands manually on the host.
7. If environment variables are required locally, document where they live, especially `.env.local` files used by Docker Compose services.

## Project Conventions

- Clever Cloud deployments are triggered from git pushes to dedicated remotes.
- The root `Justfile` is the source of truth for deployment commands.
- The root `docker-compose.yml` is the source of truth for local multi-service execution.
- The default way to run the project locally is through Docker Compose.
- Do not introduce instructions that rely on `npm install` on the host unless explicitly requested by the user.
- `README.md` should document:
  - how to install `just`
  - how to start the project locally with Docker Compose
  - the main deployment commands
  - any important assumptions about remotes, branches, or environment setup

## Change Checklist

Before finishing, verify:

- `Justfile` recipes are coherent and reusable
- Local run instructions prefer `docker compose` / `just up`
- `README.md` matches the current commands exactly
- New deployment behavior is discoverable by someone onboarding to the project
- If environment expectations changed, they are documented
