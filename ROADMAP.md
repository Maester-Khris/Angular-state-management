## Sprint 04 — Current (Week of 2026-W15)
**Theme: Post Model & Data Quality**

| User Story | Module(s) | Priority | Status |
|---|---|---|---|
| Extend Post model: slug, hashtags, readTime | `node-backend`, `ng-frontend` | Core | Planned |
| Reseed database with on-scope engineering content and real images | `python-search-api`, `node-backend` | Core | Planned |
| Rebuild Qdrant index from reseeded data | `python-search-api` | Core | Planned |

### Sprint 04 — Engineering Notes
- `readTime` should be computed at write time (word count / 200) and stored —
  not computed on the client
- Slug must be unique — generate from title + uuid suffix to avoid collisions
- Hashtags are a string array on the Post model — search-bar tag filter
  depends on this field being present before it can be implemented
- Qdrant index must be rebuilt after reseed — existing embeddings reference
  old post UUIDs and will return stale results

---

## Sprint 05 — Next
**Theme: Mobile Quick View + Search Polish**

| User Story | Module(s) | Priority | Status |
|---|---|---|---|
| Quick view mobile layout (≤600px) — content first, Up next list, swipe | `ng-frontend` | Core | Planned |
| AI search results panel layout refinement | `ng-frontend` | Core | Planned |
| Feature flag: FEATURE_AI_SEARCH enabled_prod: true | `node-backend` | Stretch | Planned |

---

## Backlog

### Search & Intelligence
- [ ] Improve query expansion with vector embeddings
- [ ] Relevance feedback loop — track which results users engage with
- [ ] Re-ranking layer post-retrieval (cross-encoder)
- [ ] RAG search engine integration test sign-off (Flag: `RAG_SEARCH`)
- [ ] Redis post-detail cache (Flag: `REDIS_POST_CACHE`)
- [ ] RRF score weighting between BM25 and vector retrieval (Flag: `RRF_RANKING`)

### Infrastructure
- [ ] OpenTelemetry cross-service tracing (Flag: `OTEL_TRACING`)
- [ ] Change Data Capture — MongoDB → Qdrant event-driven sync (Flag: `CDC_SYNC`)
- [ ] CI pipeline: python-search-api integration tests on every PR
- [ ] Containerize polyglot services for Kubernetes

### Reader Experience
- [ ] Reading progress indicator on post detail
- [ ] Offline reading mode (PWA + service worker)
- [ ] Post detail swipe-to-related transition (Flag: `SWIPE_TO_RELATED`)

### Performance
- [ ] Benchmark Node.js analytics middleware (k6 or autocannon)
- [ ] Evaluate SSR partial hydration on ng-frontend