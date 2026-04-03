# Task: [short name — e.g. "add-groq-toggle-endpoint"]

## Scope
<!-- Which packages are touched. Delete rows that don't apply. -->
- [ ] ng-frontend
- [ ] node-backend
- [ ] python-search-api
- [ ] data-utils

## Role
You are a full-stack engineer fluent in Angular 17, Node/Express, and FastAPI.
You respect the service boundaries defined in .agent/AGENTS.md.
[Add any task-specific persona detail here.]

## Context
<!-- What exists today. Be specific: file paths, current behaviour, pain points.
     For cross-service tasks describe the current data flow end-to-end. -->

Current flow:
  Angular SearchBarComponent
    → POST /api/v1/search  (node-backend/routing/home.js)
    → remotesearch.js      (node-backend/services/remotesearch.js)
    → python-search-api    (app.py → services/)

Pain points:
  -
  -

## Task
<!-- Numbered. One deliverable per item.
     For cross-service tasks, order by layer: Python first → Node → Angular. -->

Python (python-search-api)
1.
2.

Node (node-backend)
3.
4.

Angular (ng-frontend)
5.
6.

## API contract
<!-- Fill this in for any new or changed endpoint.
     Agent must not deviate from this contract. -->

POST /api/v1/search
Request:
  {
    "query": string,
    "mode": "keyword" | "meaning",
    "groq": boolean          // new field
  }
Response:
  {
    "results": [...],
    "meta": { "mode": string, "groq_enhanced": boolean }
  }

## Constraints
- Do not change the endpoint path or HTTP method of existing routes
- Do not remove or rename existing exported functions/classes
- Python: pin any new dependency in requirements.txt
- Node: use Vitest for any new test — no Jest
- No hardcoded secrets — use process.env / environment.ts
[Add task-specific constraints here]

## Expected output

python-search-api
- `services/inference.py`       — [what changes]
- `app.py`                      — [new route registration if needed]
- `requirements.txt`            — [if new deps]
- `test.rest`                   — add a curl/REST example for new endpoint

node-backend
- `services/remotesearch.js`    — [what changes]
- `routing/home.js`             — [if route sig changes]
- `tests/[name].test.js`        — smoke test for new logic

ng-frontend
- `search-bar.component.ts`     — [what changes]
- `search-bar.component.html`

## Evaluation checklist
- [ ] API contract above is implemented exactly as specified
- [ ] Existing tests pass — no deletions to fix failures
- [ ] New endpoint has entry in test.rest
- [ ] No secrets hardcoded
- [ ] Service boundary respected (Angular → Node → Python only)

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: