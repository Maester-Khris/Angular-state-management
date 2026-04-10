# Postair monorepo

## What this is
Engineering knowledge platform. Angular frontend, Node API, Python search service.
Monorepo on Vercel (Angular + Node) and Railway (Python).

## Services and ports
| Service | Dir | Local port | Purpose |
|---|---|---|---|
| Angular | ng-frontend/ | 4200 | Frontend SSR |
| Node | node-backend/ | 3000 | API + Python proxy |
| Python | python-search-api/ | 5000 | Semantic search |

## Non-obvious architecture decisions
- Angular calls Node for everything — never calls Python directly (security)
- FEATURE_AI_SEARCH env var gates the AI path on Node — never in Angular bundle
- Session queue lives in browser memory (SessionQueueService) — no server state
- Quick view uses /home/quick-view/:uuid child route — same overlay pattern as /home/view/:uuid

## Key shared types
Post interface is in ng-frontend/src/app/core/remote-api.service.ts
AiSearchResponse interface is in the same file

## Before making changes
- Read the relevant service's CLAUDE.md first
- Check .agent/tasks/ for the active task spec
- Never change vm$ stream shape in HomeComponent — downstream templates depend on it
- Never expose pythonBaseUrl or internalApiKey in Angular environment files

## Git hygiene

After completing any of the following, stage all modified files and create multiple commits(logical grouping of changes). Never push — commit only.

Triggers:
- A phase in an exec file is marked done (phase N-of-M checklist complete)
- A standalone task with no exec file is complete
- Any session that modifies more than one file

Commit sequence:
  git add -A
  git commit -m "[scope] phase N: [one-line summary from Log Output field]"

Scope is the service directory prefix:
  ng-frontend   → [ng] phase 2: add quick-view components and route
  node-backend  → [node] add /api/search/ai proxy route
  python        → [python] fix CORS allowed origins
  cross-service → [infra] add feature flag FEATURE_AI_SEARCH

Rules:
- Commit message must reference the phase or task name
- Never commit .env files or any file matching .gitignore
- If the build check fails, do not commit — fix first
- If git status shows unexpected files outside the phase file list, stop and
  report before committing

## Commands

# One-time per terminal session (doppler injects env vars):
ng-frontend:  cd ng-frontend && doppler run -- ng serve
              cd ng-frontend && doppler run -- ng build
node-backend: cd node-backend && doppler run -- npm run dev
python:       cd python-search-api && doppler run -- python app.py

# Doppler project config (run once after clone if not already set up):
# doppler setup --project postair --config dev_nk --no-interactive
# (run this inside each service directory that needs it)

## Build checks (agent use)
ng-frontend:  cd ng-frontend && ng build 2>&1 | tail -20
node-backend: cd node-backend && doppler setup --project postair --config test --no-interactive && doppler run -- npm run test
 2>&1 | tail -20
python:       cd python-search-api && python -m pytest 2>&1 | tail -20

## Agent instructions
Full agent protocol: .agent/AGENTS.md — read this before any task work.