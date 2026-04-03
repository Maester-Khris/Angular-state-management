# Agent Instructions

## Read this file fully before any action.
## If a task file exists in .agent/tasks/, read it next and emit a plan before writing code.

## Monorepo map

ng-frontend/         Angular 17 standalone — UI, components, search bar
node-backend/        Express + Vitest — REST API, auth, analytics, search routing
  routing/           Route handlers (activity, auth, home, profile)
  services/          Business logic (remotesearch.js ← search bridge to Python)
  database/          Mongoose models, DAOs, seeders
  middleware/        Auth guards
  tests/             Unit + integration tests (Vitest)
python-search-api/   FastAPI — Typesense full-text + semantic embeddings + Groq inference
  app.py             FastAPI entry point
  services/          embedding_service.py, inference.py (Groq)
  utilities/         Key generation helpers
  seeders/           Data seeding scripts
data-utils/          Standalone scripts — indexing, data prep (no runtime dependency)

## Service boundaries

Angular  →  node-backend  (REST, JWT auth)
node-backend  →  python-search-api  (via remotesearch.js → HTTP)
python-search-api  →  Typesense (keyword/semantic)
python-search-api  →  Groq API (inference/Ask AI)

Never bypass boundaries: Angular must not call python-search-api directly.
node-backend is the single gateway.

## Language + framework rules per package

ng-frontend
  - Angular 17+, standalone components, signals preferred over RxJS for local state
  - No direct HTTP calls to python-search-api

node-backend
  - Node 20+, ESM or CJS (check package.json type field before adding imports)
  - Tests: Vitest only — never introduce Jest
  - New routes go in routing/, new logic goes in services/
  - Auth always goes through middleware/auth.js

python-search-api
  - Python 3.11+, FastAPI, async handlers
  - New dependencies must be added to requirements.txt with pinned version
  - Embedding logic stays in services/embedding_service.py
  - Groq calls stay in services/inference.py
  - No business logic in app.py — only route registration

data-utils
  - Plain Python or Node scripts, no framework assumptions
  - Must be runnable standalone (no import from other packages)

## Naming conventions

node-backend services   camelCase files, named exports
python services         snake_case files, class or function per concern
Angular components      kebab-case selector, PascalCase class
API endpoints           /api/v1/[resource]/[action]

## Planning protocol

For any task touching more than one package:
  1. List every file you will CREATE, MODIFY, or DELETE — with full relative paths
  2. List files you will NOT touch (especially cross-package contracts)
  3. Flag any missing context (env vars, external API keys, schema details)
  4. State which service boundary is crossed and how (new endpoint? updated payload?)
  5. Wait for explicit go-ahead before writing code

## Evaluation defaults

Before submitting any implementation:
  - [ ] No new dependency added without listing it in the task file
  - [ ] Service boundary rules respected
  - [ ] Existing tests still pass (do not delete tests to fix failures)
  - [ ] New logic has at least a smoke-test or curl example in test.rest
  - [ ] No secrets or API keys hardcoded