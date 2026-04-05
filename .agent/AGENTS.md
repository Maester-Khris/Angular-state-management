# Agent Instructions

## Read this file fully before any action.

## Monorepo map

ng-frontend/         Angular 17 standalone — UI, components, search bar
node-backend/        Express + Vitest — REST API, auth, analytics, search routing
  routing/           Route handlers (activity, auth, home, profile)
  services/          Business logic (remotesearch.js ← search bridge to Python)
  database/          Mongoose models, DAOs, seeders
  middleware/        Auth guards
  tests/             Unit + integration tests (Vitest)
python-search-api/   Flask — Qdrant semantic search + Groq inference
  app.py             Flask entry point
  services/          embedding_service.py, inference.py (Groq)
  utilities/         Key generation helpers
  seeders/           Data seeding scripts
data-utils/          Standalone scripts — indexing, data prep (no runtime dependency)

## Service boundaries

Angular      →  node-backend          (REST, JWT auth)
node-backend →  python-search-api     (via remotesearch.js → HTTP)
python-search-api → Qdrant            (vector search)
python-search-api → Groq API          (inference / Ask AI)

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
  - Python 3.11+, Flask, sync handlers (asyncio.run for async calls)
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
API endpoints           /api/[resource] — no version prefix at current stage

## Planning protocol

### Trigger A — task file received from .agent/tasks/
You are in planning mode. Execute the Task intake protocol below.
Do not write any code until the user explicitly says "execute".

### Trigger B — multi-package task without a task file
Before writing any code:
  1. List every file you will CREATE, MODIFY, or DELETE — with full relative paths
  2. List files you will NOT touch (especially cross-package contracts)
  3. Flag any missing context (env vars, external API keys, schema details)
  4. State which service boundary is crossed and how
  5. Wait for explicit go-ahead

## Task intake protocol

### Step 1 — Emit task.plan.md

Create `.agent/tasks/[task-name].plan.md`:

---
generated: YYYY-MM-DD
source: [task-name].md
phases: [N]
---

# Plan — [Task Title]

## Scope confirmation
[Restate scope from task file in your own words. Flag any ambiguity.]

## Files inventory
| Action | File | Reason |
|--------|------|--------|
| CREATE | path/to/file | why |
| MODIFY | path/to/file | what changes |

## Files that must not change
[List explicitly — cross-package contracts, shared interfaces, stream shapes]

## Service boundaries crossed
[None / or: describe crossing — new endpoint, updated payload shape, etc.]

## Missing context
[Anything not answerable from the task file. If none: "None — task is complete."]

## Phase breakdown

### Phase 1 — [name]
Goal: [one sentence]
Files: [list]
Done when: [measurable condition]

### Phase 2 — [name]
Goal: [one sentence]
Files: [list]
Done when: [measurable condition]

## Risks
[Non-obvious side effects, migration concerns, order-of-operations issues]


### Step 2 — Emit task.exec.md

Create `.agent/tasks/[task-name].exec.md`:

---
status: pending
phase: 1-of-[N]
assigned: claude-code
generated: YYYY-MM-DD
---

# Execution brief — [Task Title]

## Session bootstrap
Read in this order before any action:
1. CLAUDE.md (repo root)
2. [service]/CLAUDE.md (each service touched this phase)
3. .agent/tasks/[task-name].md (full task spec)
4. .agent/tasks/[task-name].plan.md (full plan)

## Current phase: Phase 1 — [name]
[Copy Phase 1 from plan verbatim]

## Exact file list for this session
CREATE  [path]
MODIFY  [path]

## Must not change this session
[Copy from plan]

## Build check
[exact command — e.g. cd ng-frontend && ng build 2>&1 | tail -20]

## Done when
- [ ] [condition]
- [ ] Build check passes with zero errors

## On completion
Update this file:
  phase: 1-of-[N] → 2-of-[N]
  Append to Log:
  ### Run 1 — YYYY-MM-DD
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [what the next session needs to know]

## Hard stops
- Do not begin Phase 2 in this session even if Phase 1 finishes early
- Do not modify files outside the exact file list above
- If a required file is missing or unreadable, stop and report — do not guess


### Step 3 — Report to the user

Output this block:

---
Plan:     .agent/tasks/[task-name].plan.md
Exec:     .agent/tasks/[task-name].exec.md
Phases:   [N]
Phase 1:  [file list]
Missing:  [None / list]
Boundary: [None / description]
---

Ready to hand to Claude Code.
To start:         pass .agent/tasks/[task-name].exec.md with "execute Phase 1"
To advance phase: update phase field in exec file and pass it again

## Evaluation defaults

Before marking any phase complete:
  - [ ] No new dependency added without listing it in the task file
  - [ ] Service boundary rules respected
  - [ ] Existing tests still pass — do not delete tests to fix failures
  - [ ] New logic has at least a smoke-test or curl example in test.rest
  - [ ] No secrets or API keys hardcoded
  - [ ] Build check passed for each service touched:
        ng-frontend:  cd ng-frontend && ng build 2>&1 | tail -20
        node-backend: cd node-backend && npm test 2>&1 | tail -20
        python:       cd python-search-api && python -m pytest 2>&1 | tail -20