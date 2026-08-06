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

## Node backend — mandatory layering

Every Node backend change must follow this exact three-layer pattern.
Never put business logic in routing. Never put database calls in services
directly — they go through the DAO in database/crud.js.

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

## Branch strategy

- `preview` is the starting point for all new work — cut every feature/fix/chore
  branch from `preview`, never from `main`.
- `main` is production-ready only — nothing lands there except a reviewed, merged PR.
- Feature branches merge into `main` via PR (see `/end-sprint`).
- After a PR merges into `main`, fast-forward `preview` to match before starting the
  next branch:
  ```bash
  git checkout preview
  git merge main
  git push origin preview
  ```
  This keeps `preview` current so the next branch always starts from the latest
  merged work, not a stale point-in-time snapshot.
- Both `main` and `preview` are protected (see Git hygiene below) — never commit
  directly to either.

## Git hygiene

### Branch check — run before staging anything

```bash
git branch --show-current
```

**If the result is `main` or `preview`: stop immediately. Do not stage or commit.**
Report:
⛔ On protected branch '<branch>'. Create a feature branch first:
git checkout -b feat/<short-description>

### When to commit

After completing any of the following, stage modified files and commit.
Never use `git add .` or `git add -A` — always name files explicitly.
Never push — commit only.

Triggers:
- A phase in an exec file is marked done (checklist complete)
- A standalone task with no exec file is complete
- Any session that modifies more than one file

### Commit sequence

```bash
# 1. Stage explicitly — name every file
git add node-backend/routing/activity.js
git add ng-frontend/src/app/core/services/remote-api.ts

# 2. Review what is staged before committing
git diff --staged --stat

# 3. Commit
git commit -m "<type>(<scope>): <short description>"
```


Type:  `feat` | `fix` | `chore` | `docs` | `refactor` | `test`
Scope: service directory — `ng-frontend` | `node-backend` | `python-search-api` | `data-utils` | `agents`

Examples:
feat(node-backend): add GET /myactivity/posts for writer feed
fix(ng-frontend): correct createPost URL to /myactivity/posts
refactor(node-backend): extend userPosts select with WriterPost fields
chore(agents): update task log after crud wiring run

### Commit message format

<type>(<scope>): <short description>

Type:  `feat` | `fix` | `chore` | `docs` | `refactor` | `test`
Scope: service directory — `ng-frontend` | `node-backend` | `python-search-api` | `data-utils` | `agents`

Examples:
feat(node-backend): add GET /myactivity/posts for writer feed
fix(ng-frontend): correct createPost URL to /myactivity/posts
refactor(node-backend): extend userPosts select with WriterPost fields
chore(agents): update task log after crud wiring run

### Hard stops

- Never commit `.env` files or any file matching `.gitignore`
- If the build check fails, do not commit — fix first
- If `git status` shows unexpected files outside the phase file list,
  stop and report before committing
- Never add an AI assistant as a git co-author

---

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
node-backend: cd node-backend && doppler setup --project postair --config test --no-interactive && doppler run -- npm run test 2>&1 | tail -20
python:       cd python-search-api && python -m pytest 2>&1 | tail -20

## Agent instructions
Full agent protocol: .agent/AGENTS.md — read this before any task work.