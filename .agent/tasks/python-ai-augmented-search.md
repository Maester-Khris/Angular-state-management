# Task: python-ai-augmented-search

## Scope
- [ ] python-search-api

## Role
You are a Python/Flask engineer working on a semantic search microservice.
You respect strict service boundaries — Python owns Qdrant and all ML/LLM logic.
Python never queries MongoDB. Python receives only a raw query string from Node.

## Context
Current flow:
  Node → POST /search        (python-search-api/app.py → EmbeddingService)
  Node → POST /search-augmented  (Qdrant → LLM → but partially broken, see pain points)
  Node → POST /web-search    (standalone SerpAPI test endpoint)

Existing services:
  - `services/embedding_service.py`  — wraps Qdrant, exposes `search_similar_post(query, limit)`
  - `services/inference.py`          — wraps Groq, exposes `generate_relevant_sources(query, context)`
  - `services/websearch.py`          — wraps SerpAPI, exposes async `search(query, limit)`

Pain points:
  - `/search-augmented` builds a `docs` variable then ignores it, passing raw `results` to LLM instead
  - No dedicated `/search/ai` endpoint — Node has no clean way to request AI-only augmentation
  - `generate_relevant_sources` does LLM formatting, but query expansion (intent detection + web query synthesis) is missing — LLM should produce an expanded search query first, then SerpAPI uses it
  - `search-augmented` and `web-search` are separate endpoints with no unified AI pipeline

Architecture we are moving to (Option C revised):
  Node fires two independent requests to Python:
    1. POST /search           → Qdrant similarity only (already exists, keep as-is)
    2. POST /search/ai        → full AI pipeline: Qdrant → LLM expand → SerpAPI → structured result
  Node never shuttles Mongo results to Python.
  Python runs its own Qdrant call on the AI path independently.

## Task

Python (python-search-api)

1. Add `expand_query` method to `services/inference.py`
   - Accepts: `query: str`, `context_docs: list[dict]` (title + description from Qdrant)
   - Uses Groq to detect user intent from `query` and dominant topic from `context_docs` titles
   - Returns a single plain-text expanded search query string (not JSON)
   - Prompt must instruct the model: return only the search string, no explanation, no quotes

2. Update `generate_relevant_sources` in `services/inference.py`
   - It currently receives raw Qdrant results and tries to format them as web sources
   - Change it to receive actual web search results from SerpAPI (list of dicts with title, url, description, favicon)
   - LLM's job: filter and rerank the web results for relevance, return structured JSON array
   - Schema per item: `{ source_name, source_url, source_small_headline, source_small_description, favicon }`

3. Add POST `/search/ai` endpoint to `app.py`
   - Accepts: `{ "query": string, "limit": int (default 5) }`
   - Pipeline (strictly sequential — each step feeds the next):
       a. Qdrant top-K via `search_svc.search_similar_post(query, limit)`
       b. LLM query expansion via `llm_svc.expand_query(query, qdrant_results)`
       c. SerpAPI web search via `asyncio.run(websearch_svc.search(expanded_query, limit=8))`
       d. LLM source structuring via `asyncio.run(llm_svc.generate_relevant_sources(query, web_results))`
   - Returns:
     ```json
     {
       "query": string,
       "expanded_query": string,
       "similar_docs": [...],
       "relevant_ext_docs": [...]
     }
     ```
   - Protected by `@require_security_key`
   - All errors caught, logged via `app.logger.error`, return 500 on failure

4. Clean up `/search-augmented` in `app.py` or deprecate it
   - If kept: fix the `docs` variable bug (currently built but unused)
   - Preferred: mark as deprecated in docstring, point to `/search/ai`
   - Do not delete — Node may still reference it

## API contract

POST /search/ai
Request:
  {
    "query": string,
    "limit": int          // optional, default 5
  }
Response 200:
  {
    "query": string,
    "expanded_query": string,
    "similar_docs": [
      {
        "uuid": string,
        "title": string,
        "description": string | null,
        "score": float
      }
    ],
    "relevant_ext_docs": [
      {
        "source_name": string,
        "source_url": string,
        "source_small_headline": string,
        "source_small_description": string,
        "favicon": string
      }
    ]
  }
Response 400: { "error": "Missing query string" }
Response 401: { "error": "Unauthorized", "message": "..." }
Response 500: { "error": "Failed to perform AI search" }

## Constraints
- Do not change `/search` endpoint — Node hybrid path depends on it
- Do not query MongoDB from Python — Python owns Qdrant only
- Do not remove `@require_security_key` from any existing or new route
- All async calls must go through `asyncio.run()` — Flask is sync, no async def routes
- Pin any new dependency in `requirements.txt`
- No hardcoded secrets — use `os.getenv()`
- `expand_query` must return a plain string — not JSON, not a dict
- LLM temperature must be 0.0 on all structured output calls

## Expected output

python-search-api
- `services/inference.py`   — add `expand_query`, fix `generate_relevant_sources` signature
- `app.py`                  — add `/search/ai` route, deprecate `/search-augmented`
- `requirements.txt`        — confirm serpapi, groq, qdrant-client pinned
- `test.rest`               — add REST example for `/search/ai`

## Evaluation checklist
- [ ] POST /search/ai returns correct schema on valid query
- [ ] `expanded_query` field is present and is a non-empty plain string
- [ ] `similar_docs` comes from Qdrant, not passed in from Node
- [ ] `relevant_ext_docs` contains favicon field
- [ ] `/search` endpoint unchanged and still passing
- [ ] No secrets hardcoded
- [ ] `asyncio.run()` used for all async calls — no `async def` route handlers
- [ ] test.rest entry added for `/search/ai`

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: