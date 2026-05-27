# Postair — Roadmap

> Human-readable planning reference. For agent task instructions see `.agent/tasks/`.
> For completed work see `CHANGELOG.md`.

---

## Sprint 08 — Current (2026-W21)
**Theme: Writer Profile Data Layer**

### 08a — Data layer unblock

| User Story | Module(s) | Flag | Priority | Status |
|---|---|---|---|---|
| Fix stats field name mismatch in /me/full-profile | node-backend | — | Core | Planned |
| Add fetchFullProfile to RemoteApi, rewire WriterProfile off MockApi | ng-frontend | — | Core | Planned |
| Gate contribution activity + recent activity in prod | ng-frontend, feature-flags | `CONTRIBUTION_ACTIVITY`, `RECENT_ACTIVITY` | Core | Planned |
| Draft row → writer console navigation | ng-frontend | — | Core | Planned |
| Scaffold /dashboard/profile/edit and /saved child routes | ng-frontend | — | Core | Planned |
| /me/full-profile integration test | node-backend | — | Core | Planned |

### 08b — New UI (follow-on)

| User Story | Module(s) | Flag | Priority | Status |
|---|---|---|---|---|
| Edit profile form: name, bio, avatar upload | ng-frontend, node-backend | — | Core | Planned |
| Saved insights list view | ng-frontend | — | Core | Planned |
| Heatmap endpoint + Angular wiring | node-backend, ng-frontend | `CONTRIBUTION_ACTIVITY` | Core | Planned |
| Profile banner image upload | ng-frontend, node-backend | — | Stretch | Planned |

---

## Backlog

### Writer Experience
- [ ] Co-auth count (requires editors[] aggregation endpoint)
- [ ] Saved insights panel (requires bookmarks/favourites feature)
- [ ] Recent activity feed (requires activity log schema)
- [ ] Media: orphan cleanup nightly job (pending records > 24h)

### Reader Experience
- [ ] Intersection Observer lazy load on post cards
- [ ] srcset responsive image variants
- [ ] Post detail swipe-to-related transition (Flag: `SWIPE_TO_RELATED`)
- [ ] Offline reading mode (PWA + service worker)

### Search & Intelligence
- [ ] RAG search engine integration test sign-off (Flag: `RAG_SEARCH`)
- [ ] RRF score weighting between BM25 and vector retrieval (Flag: `RRF_RANKING`)
- [ ] Relevance feedback loop — track which results users engage with
- [ ] Re-ranking layer post-retrieval (cross-encoder)
- [ ] Improve query expansion with vector embeddings

### Infrastructure
- [ ] Redis post-detail cache (Flag: `REDIS_POST_CACHE`)
- [ ] OpenTelemetry cross-service tracing (Flag: `OTEL_TRACING`)
- [ ] Change Data Capture — MongoDB → Qdrant event-driven sync (Flag: `CDC_SYNC`)
- [ ] CI pipeline: python-search-api integration tests on every PR
- [ ] Containerize polyglot services for Kubernetes

### Performance
- [ ] Benchmark Node.js analytics middleware (k6 or autocannon)
- [ ] Evaluate SSR partial hydration on ng-frontend

---

## Guiding Constraints

- One week per sprint, 1–3 user stories maximum
- All work deploys to `main` via trunk-based strategy — no long-lived feature branches
- Nothing ships to production without its feature flag explicitly set to `enabled_prod: true`
- `CHANGELOG.md` is updated at sprint close, not mid-sprint
- Data loading strategy: parallel REST + forkJoin — no GraphQL at current scale
- Default banner: CSS gradient — no image upload or model change until Sprint 08b