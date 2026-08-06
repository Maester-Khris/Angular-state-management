# E2E Scope Mapping — Postair Platform

> Derived directly from the codebase (routes, endpoints, feature flags), not from exploratory agent runs. Companion to `docs/research/2026-08-06-llm-agent-e2e-testing.md` (methodology research).

## 1. Reader View (unauthenticated + logged-in visitor)

| Flow | Frontend route/component | Backend endpoint(s) |
|---|---|---|
| Home feed load | `/home`, `HomeResolver` | `GET /api/feed`, `GET /api/config` |
| Keyword/hybrid search | `search-bar` | `GET /api/search` (mode=keyword\|hybrid → proxies to Python on hybrid) |
| AI-augmented search | `ai-results-panel` | `POST /api/search/ai` → Python `/search/ai` (gated by `FEATURE_AI_SEARCH` + `RAG_SEARCH` flag, `enabled_prod: false`) |
| Post detail (focus read) | `/home/view/:uuid` | `GET /api/posts/:uuid`, `GET /api/posts/slug/:slug` (ETag/Cache-Control) |
| Quick view overlay | `/home/quick-view/:uuid` | same as above |
| Newsletter signup | footer | `POST /api/newsletter` |
| View/impression tracking (background) | implicit on feed/detail | `POST /api/analytics/events`, `POST /api/analytics/batch` → BullMQ `analytics-queue` |

## 2. Auth

| Flow | Route | Endpoint |
|---|---|---|
| Signup | `/signup` | `POST /auth/signup` |
| OTP verify / resend | (post-signup) | `POST /auth/verify-otp`, `POST /auth/resend-otp` → BullMQ `mailing-queue` |
| Login | `/login` | `POST /auth/login` |
| Google OAuth | `/login` | `POST /auth/google` |
| Session check | (app init) | `GET /auth/me` |
| Logout | (profile menu) | `GET /profile/logout` (blacklists token) |

## 3. Writer Console — `/dashboard/myactivity` (auth-gated, `pendingChangesGuard`)

| Flow | Endpoint |
|---|---|
| List own posts | `GET /myactivity/posts` |
| Create draft / publish directly | `POST /myactivity/posts` (slug + `publishedAt` set on first publish) |
| Edit post, incl. draft→publish transition | `PUT /myactivity/posts/:postuuid` |
| Delete post | `DELETE /myactivity/posts/:postuuid` |
| Media upload (cover image) | `POST /myactivity/upload` (SHA-256 dedup, rate-limited 20/10min) |
| Media delete | `DELETE /myactivity/media/:mediaId` |
| Tag autocomplete | `GET /api/tags/search`, `GET /api/tags` |
| Add co-author/editor | `POST /posts/:uuid/editors`, `GET /users/lookup/:email` |
| Unsaved-changes guard on navigate-away | `pendingChangesGuard` — no backend call, pure client-side |

## 4. Writer Dashboard / Profile — `/dashboard/profile` (auth-gated)

| Flow | Endpoint |
|---|---|
| Full profile load (single call) | `GET /profile/me/full-profile` (profile + stats + drafts + favorites, `Promise.allSettled`) |
| Draft row → console w/ draft preloaded | client-side only (router state) |
| Fav card (image + DRAFT badge) | client-side render of data from above |
| Empty states (no drafts / no favs) | client-side |
| `/dashboard/profile/edit`, `/dashboard/profile/saved` | route shells only — **not functionally testable yet**, Sprint 08b |
| Contribution heatmap, Recent Activity | feature-flagged **off** in prod (`CONTRIBUTION_ACTIVITY`, `RECENT_ACTIVITY`) — E2E should assert they're **absent** by default, not just skip them |

## 5. Cross-service integration surfaces (highest risk — prioritize these)

These aren't single-page flows, they're the seams between services, and every fragile bug found this session lived in a seam like these:

- **Search fan-out**: Angular → Node `/api/search` → Python `/search` or `/search-augmented` (hybrid mode only). Must verify graceful lexical-only degradation when Python is unreachable (there's already a unit test for this — needs an E2E-level equivalent).
- **AI search proxy**: Node `/api/search/ai` → Python `/search/ai` → Python `/web-search` enrichment. Currently gated off in prod (`RAG_SEARCH: enabled_prod=false`) — E2E must confirm it stays hidden/inert when the flag is off, not just that it works when on.
- **Media upload**: Node → Cloudinary. Real Cloudinary calls in automated E2E are costly/flaky — needs a decision (mock the Cloudinary SDK boundary vs. a dedicated test-preset bucket).
- **Async job queues** (analytics events, OTP mail): Node → BullMQ → Redis. This session found a real race — a locally running dev server's worker can steal jobs from a same-prefix Redis instance mid-test. **Any E2E run must use its own `BULL_PREFIX`**, exactly like the fixed test suite now does, or results will be flaky for reasons that have nothing to do with the app.
- **Feature-flag truth**: `GET /api/config` response vs. what's actually rendered/reachable. Worth a generic "flag off → route/section is inert, not just hidden" check pattern, reusable per flag.
- **Auth/JWT lifecycle**: token issuance → use across authenticated endpoints → blacklist on logout → rejection after logout. The auth-mock bugs found in the unit/integration test suite this session (CJS/`vi.mock` interop) suggest the real auth path deserves direct E2E coverage, not just mocked-auth test coverage.

## 6. Known fragile areas to weight heavily (from this session's findings, not guesswork)

- `crud.js`'s `updatePost()` uses `findOneAndUpdate()` without `runValidators: true` — schema validation (e.g. description `minlength: 120`) silently doesn't run on update. An E2E case that edits a post's description to something too short, expecting a validation error, would actually catch this real gap today.
- No SSR — per-post social-preview correctness (dynamic OG tags in `post-detail.ts`) only matters for crawlers, out of scope for user-flow E2E, in scope for the separate OpenGraph work already shipped.
- BullMQ/Redis prefix collisions (see above) — an environment-setup concern, not a feature bug, but it will produce false E2E failures if not handled up front.

## 7. Open before writing scripted tests

- **Test data**: needs a dedicated MongoDB test account/seed strategy — reuse the same Atlas `test`-config cluster the integration tests already use, or a separate seed script? Not yet decided.
- **Cloudinary boundary**: mock vs. real test-preset bucket for media-upload E2E — not yet decided.
- **Queue isolation**: confirm E2E runner sets its own `BULL_PREFIX` (and ideally its own Redis DB index) before any queue-touching flow is scripted.
