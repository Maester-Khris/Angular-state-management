# Task: node-search-routing-option-c

## Scope
- [ ] node-backend

## Role
You are a Node/Express engineer working on a search orchestration layer.
Node owns MongoDB and orchestrates the fast hybrid search path only.
Node never calls Qdrant, runs embeddings, or calls SerpAPI directly.
Node never shuttles MongoDB results to Python.

## Context
Current flow:
  GET /api/search (routing/home.js)
    → Promise.allSettled([mongo FTS, python /search])
    → mergeResults()
    → returns { query, mode, count, results, proposedLinks: [] }

  `proposedLinks` is always an empty array — a dead field, never populated.

  Python now exposes (after Job 1 completes):
    POST /search        → Qdrant similarity only
    POST /search/ai     → Qdrant → LLM expand → SerpAPI → { similar_docs, expanded_query, relevant_ext_docs }

Architecture we are moving to (Option C revised):
  Angular fires two independent requests:
    1. GET /api/search?q=...&mode=hybrid   → Node → [Mongo FTS || Python /search] → fast hybrid results
    2. POST /search/ai                     → Angular → Python directly → AI pipeline results

  Node is responsible for path 1 only.
  Angular calls Python directly for path 2 — Node is not in the AI path at all.
  This avoids the extra Node hop on the slow AI path and keeps Node's responsibility clear:
  MongoDB orchestration and hybrid result merging only.

  keyword+ai and hybrid+ai search modes are therefore client-side compositions:
    Angular fires GET /api/search (Node) + POST /search/ai (Python) in parallel,
    renders hybrid results immediately, patches AI results when the second resolves.

Pain points:
  - `proposedLinks: []` is a dead field — no route ever populates it, misleads consumers
  - `remotesearch.js` payload to Python should be verified — must never include Mongo data
  - Response shape has no `meta` field — consumers cannot tell which mode actually ran
    or whether Python was available

## Task

Node (node-backend)

1. Clean up GET `/api/search` response shape in `routing/home.js`
   - Remove `proposedLinks` field entirely — AI results are Angular's responsibility via direct Python call
   - Add a `meta` object to the response:
     ```json
     "meta": {
       "mode": "hybrid" | "lexical",
       "python_available": boolean
     }
     ```
     `python_available` reflects whether `checkPythonStatus()` returned connected on this request.
   - No logic changes to the hybrid/lexical flow or `Promise.allSettled` pattern — shape only

2. Verify `services/remotesearch.js`
   - Confirm `getSemanticMatches(query, limit)` sends only `{ query, limit }` to Python — no Mongo payload
   - Confirm `X-Internal-Key` header is forwarded on all Python calls
   - No new functions needed — `getAIAugmentedResults` is not required, Angular calls Python directly
   - If any Mongo data is found leaking into the Python request body, remove it and document the fix

## API contract

GET /api/search
Request params: q (string, required), limit (int, optional), mode (string, default "hybrid")
Response 200:
  {
    "query": string,
    "mode": string,
    "count": int,
    "results": [...],
    "meta": {
      "mode": "hybrid" | "lexical",
      "python_available": boolean
    }
  }

Note: No /api/search/ai endpoint on Node. Angular calls Python POST /search/ai directly.

## Constraints
- Do not add a /api/search/ai endpoint to Node — Angular is the orchestrator for the AI path
- Do not add Qdrant, SerpAPI, or LLM logic to Node — Python owns those
- Do not pass MongoDB results to Python in any request
- Do not change the GET /api/search path, HTTP method, or hybrid/lexical logic
- Keep `checkPythonStatus()` fallback logic intact
- No hardcoded secrets — use process.env
- No new test framework — use Vitest (already in project)

## Expected output

node-backend
- `routing/home.js`           — remove `proposedLinks`, add `meta` to GET /api/search response
- `services/remotesearch.js`  — verify payload cleanliness, document any fix found
- `tests/search.test.js`      — assert `proposedLinks` absent, assert `meta` present with correct shape

## Evaluation checklist
- [ ] GET /api/search response no longer contains `proposedLinks`
- [ ] GET /api/search response contains `meta.mode` and `meta.python_available`
- [ ] `meta.python_available` is `false` when Python is unreachable (lexical fallback triggered)
- [ ] `getSemanticMatches` sends only `{ query, limit }` to Python — verified in code and test
- [ ] No /api/search/ai endpoint added to Node
- [ ] Existing hybrid and lexical flows unchanged and passing
- [ ] X-Internal-Key forwarded on all Python calls

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: