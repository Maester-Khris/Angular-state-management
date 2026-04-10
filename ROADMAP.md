## Sprint 06 — Current (Week of 2026-W16)
**Theme: Writer & Admin — Authoring MVP**

| User Story | Module(s) | Priority | Status |
|---|---|---|---|
| Post creation with draft save | ng-frontend, node-backend | Core | Planned |
| Publish flow (slug, publishedAt, isPublic) | node-backend | Core | Planned |

> Auth: Google Sign-In only. Manual auth deferred.
> Admin backoffice deferred to a later sprint.

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
- [x] Mobile quick view layout (≤600px) — completed
- [ ] Offline reading mode (PWA + service worker)
- [ ] Post detail swipe-to-related transition (Flag: `SWIPE_TO_RELATED`)

### Performance
- [ ] Benchmark Node.js analytics middleware (k6 or autocannon)
- [ ] Evaluate SSR partial hydration on ng-frontend
