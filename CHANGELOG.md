# Changelog

> Reverse-chronological sprint log. Updated at sprint close.
> For upcoming work see `ROADMAP.md`. For flag registry see `feature-flags.json`.

---

## [Sprint 04] — 2026-W14 — Planned
**Theme: Observability & Data Resilience**

### Planned
- [ ] `node-backend`, `python-search-api` — Introduce OpenTelemetry for cross-service tracing.
      Implement W3C Trace Context to track requests across
      `ng-frontend` → `node-backend` → `python-search-api` (Flag: `OTEL_TRACING`)
- [ ] `data-utils`, `node-backend` — Prototype Change Data Capture (CDC) logic.
      Move from manual `data-utils` seeding to an event-driven sync
      between MongoDB and the Qdrant vector store (Flag: `CDC_SYNC`)
- [ ] `python-search-api` — Implement Reciprocal Rank Fusion (RRF) to optimize
      score weighting between BM25 and vector retrieval results (Flag: `RRF_RANKING`)

---

## [Sprint 03] — 2026-W13 — Current
**Theme: Intelligence & Experience** — Trunk-based deployment.

### In Progress
- [ ] `python-search-api` — RAG search engine (hybrid + AI-augmented).
      Current focus: integration test validation (Flag: `RAG_SEARCH`)
- [ ] `node-backend`, `ng-frontend` — Redis-backed post detail cache;
      focused reading mode UI (Flag: `REDIS_POST_CACHE`, `FOCUS_MODE`)
- [ ] `ng-frontend` — Vertical swipe quick post overview (Flag: `VERTICAL_SWIPE`)

### Stretch
- [ ] `ng-frontend` — Post detail performance pass:
      swipe-to-related-post transition optimization (Flag: `SWIPE_TO_RELATED`)

---

## [Sprint 02] — 2026-W12 — Completed

### Completed
- [x] `python-search-api` — Hybrid search pipeline (BM25 + Qdrant vector retrieval)
- [x] Root — Feature flag registry introduced (`feature-flags.json`)
- [x] `ng-frontend` — Focused reading mode — blurred background (Flag: `FOCUS_MODE`, enabled_prod: true)