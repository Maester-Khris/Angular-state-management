# Task: python-integration-tests

## Scope
- [ ] python-search-api

## Role
You are a Python engineer specialising in API testing.
You write pytest integration tests that hit the running Flask app via its HTTP layer —
not unit tests that mock internals. Tests must reflect real endpoint contracts and
catch regressions in request validation, response shape, auth enforcement, and error handling.
You do not test third-party services (Qdrant, Groq, SerpAPI) — you mock them at the service
boundary so tests are deterministic and do not require live credentials or network access.

## Context

Existing endpoints in `app.py`:

| Method | Path                | Auth | Description                              |
|--------|---------------------|------|------------------------------------------|
| GET    | /                   | No   | Root health ping                         |
| GET    | /health             | No   | Service status                           |
| POST   | /embed              | Yes  | Embed and store a post in Qdrant         |
| POST   | /search             | Yes  | Qdrant similarity search                 |
| POST   | /search/ai          | Yes  | Qdrant → LLM expand → SerpAPI pipeline  |
| POST   | /web-search         | Yes  | Standalone SerpAPI search                |
| POST   | /search-augmented   | Yes  | Deprecated — keep contract test only     |

Auth mechanism: `X-Internal-Key` header checked against `INTERNAL_API_KEY` env var.

Service layer (to be mocked at boundary):
- `EmbeddingService`   — `store_post()`, `search_similar_post()`
- `InferenceService`   — `expand_query()`, `generate_relevant_sources()`
- `WebSearchService`   — `search()`

Existing test tooling: none — this is greenfield.

Dependency note: Job 1 (python-ai-augmented-search) must be completed before this job runs,
as `/search/ai` is tested here and does not exist until Job 1 is merged.

## Task

Python (python-search-api)

1. Set up pytest infrastructure
   - Create `tests/` directory with `__init__.py` and `conftest.py`
   - `conftest.py` must:
     - Provide a `client` fixture using Flask's test client (`app.test_client()`)
     - Set `INTERNAL_API_KEY=test-key` and all other required env vars via `monkeypatch` or fixture scope
     - Provide a `auth_headers` fixture returning `{"X-Internal-Key": "test-key"}`
     - Provide mock fixtures for each service boundary:
       - `mock_embedding_svc` — patches `EmbeddingService` on the app instance
       - `mock_inference_svc` — patches `InferenceService` on the app instance
       - `mock_websearch_svc` — patches `WebSearchService` on the app instance

2. Write `tests/test_public_endpoints.py`
   Tests for unauthenticated endpoints:

   - `test_root_returns_200`
     GET / → 200, body contains `"status": "online"`

   - `test_health_returns_200`
     GET /health → 200, body contains `"status": "OK"`

3. Write `tests/test_embed_endpoint.py`
   Tests for POST /embed:

   - `test_embed_success`
     Valid payload `{ postuuid, title, description }` → 201, body contains `"status": "success"` and `"uuid"`

   - `test_embed_missing_uuid`
     Payload without `postuuid` → 400

   - `test_embed_no_auth`
     Valid payload, no `X-Internal-Key` header → 401

   - `test_embed_wrong_key`
     Valid payload, wrong key → 401

4. Write `tests/test_search_endpoint.py`
   Tests for POST /search:

   - `test_search_success`
     Valid `{ query }` → 200, response shape: `{ query, count, results: [...] }`
     Mock `search_similar_post` to return 2 fake docs.
     Assert `count == 2` and `results` contains expected fields: `uuid, title, description, score`

   - `test_search_missing_query`
     `{}` body → 400

   - `test_search_no_auth` → 401

   - `test_search_respects_limit`
     `{ query, limit: 3 }` → assert `search_similar_post` was called with `limit=3`

5. Write `tests/test_search_ai_endpoint.py`
   Tests for POST /search/ai (core pipeline):

   - `test_search_ai_success`
     Valid `{ query }` → 200
     Mock chain:
       - `search_similar_post` returns 3 fake docs
       - `expand_query` returns `"expanded search string"`
       - `websearch_svc.search` returns 3 fake web results
       - `generate_relevant_sources` returns 2 structured source dicts
     Assert response shape:
       ```json
       {
         "query": string,
         "expanded_query": string,
         "similar_docs": [...],
         "relevant_ext_docs": [...]
       }
       ```
     Assert `expanded_query == "expanded search string"`
     Assert `len(similar_docs) == 3`
     Assert `len(relevant_ext_docs) == 2`

   - `test_search_ai_expanded_query_forwarded_to_websearch`
     Assert `websearch_svc.search` was called with the string returned by `expand_query`,
     not the original query — verifies the pipeline wiring is correct

   - `test_search_ai_missing_query` → 400

   - `test_search_ai_no_auth` → 401

   - `test_search_ai_qdrant_failure`
     `search_similar_post` raises `Exception("Qdrant unavailable")`
     → 500, body contains `"error"`

   - `test_search_ai_llm_failure`
     `expand_query` raises `Exception("Groq timeout")`
     → 500, body contains `"error"`

   - `test_search_ai_websearch_failure`
     `websearch_svc.search` raises `Exception("SerpAPI 403")`
     → 500, body contains `"error"`

6. Write `tests/test_websearch_endpoint.py`
   Tests for POST /web-search:

   - `test_websearch_success`
     Valid `{ query }` → 200, shape: `{ query, count, results: [...] }`
     Mock `websearch_svc.search` to return 3 results. Assert `count == 3`.

   - `test_websearch_missing_query` → 400

   - `test_websearch_no_auth` → 401

7. Write `tests/test_search_augmented_endpoint.py`
   Contract-only tests for deprecated POST /search-augmented:

   - `test_search_augmented_still_responds`
     Valid `{ query }` → not 404 (endpoint still exists)

   - `test_search_augmented_no_auth` → 401

## Fixtures — mock return shapes

Use these shapes consistently across all test files:

```python
FAKE_QDRANT_DOCS = [
    {"uuid": "uuid-1", "title": "AI in Healthcare", "description": "Overview of ML in medicine", "score": 0.91},
    {"uuid": "uuid-2", "title": "Deep Learning Basics", "description": "Intro to neural nets", "score": 0.87},
    {"uuid": "uuid-3", "title": "NLP Transformers", "description": "BERT and GPT explained", "score": 0.83},
]

FAKE_WEB_RESULTS = [
    {"title": "AI News", "url": "https://ainews.com", "description": "Latest AI research", "favicon": "https://ainews.com/favicon.ico"},
    {"title": "ML Weekly", "url": "https://mlweekly.com", "description": "Weekly ML digest", "favicon": "https://mlweekly.com/favicon.ico"},
    {"title": "Papers With Code", "url": "https://paperswithcode.com", "description": "ML papers", "favicon": "https://paperswithcode.com/favicon.ico"},
]

FAKE_STRUCTURED_SOURCES = [
    {"source_name": "AI News", "source_url": "https://ainews.com", "source_small_headline": "Top AI resource", "source_small_description": "Latest research", "favicon": "https://ainews.com/favicon.ico"},
    {"source_name": "ML Weekly", "source_url": "https://mlweekly.com", "source_small_headline": "ML digest", "source_small_description": "Weekly updates", "favicon": "https://mlweekly.com/favicon.ico"},
]
```

## Constraints
- Integration tests only — hit Flask via `app.test_client()`, never call service methods directly
- Mock at the service instance level (patch `search_svc`, `llm_svc`, `websearch_svc` on the app) — do not mock `asyncio.run`
- Tests must pass without live Qdrant, Groq, or SerpAPI credentials
- Do not delete or alter `app.py` or any service file
- Use `pytest` and `pytest-mock` only — no unittest, no additional frameworks
- Each test file is independently runnable — no cross-file state
- All env vars set in fixtures, never hardcoded in test bodies
- Pin `pytest` and `pytest-mock` in `requirements.txt`

## Expected output

python-search-api
- `tests/__init__.py`                          — empty, marks package
- `tests/conftest.py`                          — client fixture, auth_headers, service mocks
- `tests/test_public_endpoints.py`             — root + health tests
- `tests/test_embed_endpoint.py`               — embed tests
- `tests/test_search_endpoint.py`              — similarity search tests
- `tests/test_search_ai_endpoint.py`           — full AI pipeline tests (most critical)
- `tests/test_websearch_endpoint.py`           — standalone web search tests
- `tests/test_search_augmented_endpoint.py`    — deprecated endpoint contract tests
- `requirements.txt`                           — add pytest, pytest-mock

## Evaluation checklist
- [ ] `pytest tests/` runs to completion with no import errors
- [ ] All tests pass without live credentials or network calls
- [ ] `test_search_ai_expanded_query_forwarded_to_websearch` explicitly asserts pipeline wiring
- [ ] Every protected endpoint has a `_no_auth` test asserting 401
- [ ] Service mocks use return values from the shared fixture shapes above
- [ ] No test imports or calls service classes directly — only via HTTP client
- [ ] `pytest` and `pytest-mock` added to `requirements.txt`

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: