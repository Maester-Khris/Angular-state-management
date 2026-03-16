# Postair — Roadmap

> Human-readable planning reference. For agent task instructions see `.agents/tasks`.
> For completed work see `CHANGELOG.md`.

---

## Sprint 03 — Current (Week of 2025-W12)

Trunk-based deployment. All unreleased work ships behind flags to `main`.

| User Story | Module(s) | Flag | Priority | Status |
|---|---|---|---|---|
| Finish RAG search engine with integration test validation | `python-search-api`, `node-backend` | `RAG_SEARCH` | Core | In Progress |
| Redis post-detail cache + focused reading mode UI | `node-backend`, `ng-frontend` | `REDIS_POST_CACHE`, `FOCUS_MODE` | Core | In Progress |
| Vertical swipe quick post overview | `ng-frontend` | `VERTICAL_SWIPE` | Core | In Progress |
| Post detail performance — swipe-to-related transition | `ng-frontend` | `SWIPE_TO_RELATED` | Stretch | Planned |

### Sprint 03 — Engineering Notes

- `RAG_SEARCH` is blocked on integration test sign-off before `enabled_prod: true`
- `VERTICAL_SWIPE` and `SWIPE_TO_RELATED` are coupled — performance pass on detail
  view should account for both before either ships to prod
- Redis caching strategy (Upstash) must be validated against the Qdrant retrieval
  latency budget before enabling in production

---

## Backlog

### Search & Intelligence
- [ ] Improve query expansion with vector embeddings (FAISS / Chroma as alternative to Qdrant)
- [ ] Add relevance feedback loop — track which search results users engage with
- [ ] Evaluate re-ranking layer post-retrieval (cross-encoder)

### Infrastructure
- [ ] Containerize polyglot services for Kubernetes
- [ ] Introduce OpenTelemetry for cross-service tracing (`python-search-api` → `node-backend`)
- [ ] CI pipeline: run `python-search-api` integration tests on every PR to `main`

### Performance
- [ ] Benchmark Node.js analytics middleware under stress (k6 or autocannon)
- [ ] Evaluate SSR or partial hydration on `ng-frontend` for initial load

### Reader Experience
- [ ] Vertical swipe — haptic feedback and gesture velocity tuning
- [ ] Reading progress indicator on post detail
- [ ] Offline reading mode (PWA + service worker caching)

---

## Guiding Constraints

- One week per sprint, 1–3 user stories maximum
- All work deploys to `main` via trunk-based strategy — no long-lived feature branches
- Nothing ships to production without its feature flag explicitly set to `enabled_prod: true`
- `CHANGELOG.md` is updated at sprint close, not mid-sprint