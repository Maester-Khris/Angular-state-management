## [AI Search Pipeline Upgrade] — 2026-08-08 — In Progress
**Theme: Query expansion quality, provider swap, semantic caching, and result-panel UX for `/search/ai`**

### Completed — Phase 0: operational continuity (missed from original scope, added mid-sprint)
- [x] `python-search-api` — Public `GET /ping` keepalive endpoint, real Qdrant round trip, no auth
- [x] `node-backend` — Public `GET /api/ping` keepalive endpoint, real MongoDB round trip, no auth
      (both exist to stop Render/Qdrant free-tier services pausing on inactivity — cronjobs.org
      registration against the real deployed URLs is the next step, pending push)
- [x] `data-utils` — `rebuild_qdrant_from_mongo.py`: one-time/recovery CLI, rebuilds the Qdrant
      collection from live Mongo posts. Found real value immediately — Qdrant's collection was
      completely empty mid-sprint, exactly the failure mode this script exists to recover from

### Completed — Phase 1: pipeline plumbing
- [x] `python-search-api` — Collapsed the pipeline's 3× separate `asyncio.run()` calls into one
      async handler/event loop; un-blocked the synchronous Qdrant/embedding call (now offloaded
      via `run_in_executor`, matching the web-search leg's existing pattern)

### Completed — reactive fixes (found while verifying Phase 0/1, not originally scoped)
- [x] `python-search-api` — Switched embeddings from Groq (`nomic-embed-text-v1_5`, which started
      404ing — not a stable product surface on Groq's side) to local `fastembed`
      (`BAAI/bge-small-en-v1.5`, 384-dim). Removes the embedding leg's external-API dependency
      entirely; model name now reads from `EMBEDDING_MODEL` (Doppler) instead of being hardcoded
- [x] `python-search-api` — Fixed a latent bug in `EmbeddingService.search_similar_post()`'s
      readiness guard: it checked `client`/`model` for `None` *before* the only code path that
      initializes them, so it silently returned `[]` forever on any fresh process — including
      the app's own startup warmup — instead of ever performing a real search

### Completed — Redis cache, eval diagnostics, Groq TPM fix (2026-08-14)
- [x] `node-backend` — Redis exact-match cache for `/api/search/ai` + hit/miss counters on
      `/health` (commits `348d738`, `434630f`, `4ceb788`) — incorrect-hit rate and latency
      p50/p95 split by hit/miss remain unbuilt, still listed under Scope below
- [x] `python-search-api` — Capped Groq's reranking completion tokens and Exa's unbounded
      snippet length feeding that call — was tripping the org's 12000 TPM limit on a single
      request regardless of call spacing; 0/10 golden queries degraded after the fix vs 3/10
      before
- [x] Ran the golden-query harness against real `relevant_uuids` labels for the first time
      (`eval/golden_queries.json`, finalized 2026-08-14) — 0.4 avg Precision@5/Recall@5, 1.0
      format compliance; root-caused to 6 pipeline causes plus a 7th finding that
      `relevant_ext_docs` has zero eval coverage — evidence-verified against live retrieval
      output, see `artifacts/ai-search-upgrade/eval-precision-recall-analysis-2026-08-14.md`
- [x] Industry-research pass on validated, cited fixes for all 7 findings (RRF, MMR,
      similarity-threshold calibration, FastEmbed's built-in cross-encoder reranker, RAGAS
      Context Precision) — `artifacts/ai-search-upgrade/pipeline-improvement-research-2026-08-14.md`
- [x] Selected and built tooling for a 30k-row eval corpus (Dev.to HF mirror, English-only,
      schema-matched) — `eval/fetch_devto_dataset.py`, verified against the live dataset;
      selection research at `artifacts/ai-search-upgrade/eval-corpus-dataset-research-2026-08-14.md`

### In progress
- [ ] Eval infra: populate dedicated `postair_eval` Mongo database + `posts_eval` Qdrant
      collection from the 30k corpus — plan at
      `docs/superpowers/plans/2026-08-14-eval-infra-setup.md`, not yet executed
- [ ] Wire `expanded_query` into Qdrant retrieval via RRF fusion — highest-leverage fix
      identified (simulated: `life` 1/5→2/5, `memory` unchanged 1/5, `intelligence` 2/5→3/5),
      not yet implemented

### Scope
- [ ] `python-search-api` — Swap SerpAPI → Exa for external web search (Tavily
      evaluated and dropped — Exa's `title`/`url`/`favicon`/`image`/`summary` fields
      cover the current `ExternalDoc` shape 1:1 from a single provider)
- [ ] `python-search-api` — Query expansion: enforce output format in code
      (`max_tokens` + post-hoc validation/truncation) instead of relying on prompt
      instructions alone; extend few-shot examples beyond single-word disambiguation
      to full query→expansion pairs
- [ ] `python-search-api` — Spike: can Exa's schema-guided `summary` field replace
      the `generate_relevant_sources` Groq reranking call outright? Validate against
      the golden set before committing either way
- [ ] `python-search-api` — Validate (golden set) whether `expand_query`'s dependency
      on live Qdrant context can be dropped; if so, run Qdrant search and query
      expansion concurrently instead of sequentially
- [ ] `node-backend` — Redis-backed cache for `/search/ai` (hit rate, incorrect-hit
      rate, latency p50/p95/p99 split by hit/miss, instrumented at the cache-read
      call site)
- [ ] `python-search-api` — Isolate `/search/ai`'s 4 pipeline stages so one leg's
      failure (e.g. the new Exa adapter degrading) doesn't 500 the whole request —
      response gains a `degraded_legs` signal instead of one outer try/except
      discarding legs that already succeeded
- [ ] `ng-frontend` — AI results panel: visual distinction between platform and web
      results (currently section-heading-only), fix expanded-query display being
      silently dropped when only internal results exist, empty-state fallback when
      both result arrays are empty, remove dead `aiToggle`/`groqToggle` outputs,
      add a `partial` state distinct from total failure (scoped inline notice per
      degraded section instead of the full-panel error takeover) plus a retry
      affordance on both `error` and `partial`

### Evaluation plan
- [ ] Golden query set (30–50 queries) + fixed corpus snapshot as the offline
      regression harness — Precision@k/Recall@k at displayed-k for the AI path,
      RAGAS Faithfulness/Answer Relevance for reranking, Redis cache hit/incorrect-hit
      rate, per-stage latency, $ per query
- [ ] Pre-registered thresholds, one variable changed at a time against the harness;
      interleaving/A/B testing noted as the documented next step at scale, not
      attempted prematurely on current traffic

### Reference
- `artifacts/ai-search-upgrade/codebase-audit.md` — pre-work state of the pipeline,
  confirmed against all 6 planned points, file:line cited
- `artifacts/ai-search-upgrade/evaluation-metrics-and-methodology.md` — metrics and
  fair-comparison methodology, industry-cited
- `artifacts/ai-search-upgrade/exa-fastmcp-client-design.md` — Exa/FastMCP adapter
  design (clean-architecture, DDD, DDIA, release-it applied)
- `artifacts/ai-search-upgrade/failure-mode-handling.md` — partial-failure design
  for the pipeline and AI results panel, release-it applied
- `docs/superpowers/plans/2026-08-09-ai-search-pipeline-upgrade.md` — full 10-phase
  implementation plan (task-by-task, TDD steps), including Phase 0's operational
  continuity work above
- `artifacts/ai-search-upgrade/eval-run-2026-08-14-baseline.md` /
  `eval-run-2026-08-14-postfix.md` — first labeled harness run and the Groq-TPM-fix
  re-run, compared
- `artifacts/ai-search-upgrade/eval-precision-recall-analysis-2026-08-14.md` — why
  Precision@5/Recall@5 are low, 6 causes + the `relevant_ext_docs` coverage gap, full
  per-query retrieval-vs-gold comparison
- `artifacts/ai-search-upgrade/pipeline-improvement-research-2026-08-14.md` — cited,
  industry-validated fixes per cause (RRF, MMR, threshold calibration, FastEmbed
  reranker, RAGAS)
- `artifacts/ai-search-upgrade/eval-corpus-dataset-research-2026-08-14.md` — public
  tech-domain dataset research, Dev.to HF mirror selected
- `docs/superpowers/plans/2026-08-14-eval-infra-setup.md` — plan to populate the
  30k-row eval Mongo/Qdrant collections

---

## [E2E Platform Validation] — 2026-08-06 — Completed
**Theme: Pure-CLI Playwright suite — reader view, writer console, writer dashboard**

### Completed
- [x] `data-utils` — `seed_e2e_account.py`: idempotent E2E test-account seeder against
      `dev_nk` Mongo, bcrypt-compatible with the real `/auth/login` endpoint (verified
      via a live curl round trip, not just DB presence)
- [x] `e2e/` — new Playwright workspace (`package.json`, `playwright.config.ts`,
      `.env.example`) — pure CLI execution, no LLM anywhere in the run path, per
      `docs/research/2026-08-06-llm-agent-e2e-testing.md`'s findings
- [x] `e2e/tests/auth.spec.ts` — real login round trip, session persistence through an
      auth-guarded route, unauthenticated-visitor redirect
- [x] `e2e/tests/reader.spec.ts` — home feed, keyword search, post detail, quick view
- [x] `e2e/tests/writer-console.spec.ts` — full create → tag autocomplete → publish →
      delete cycle against the real backend, self-cleaning (UI delete as the real test
      step, API-level `afterEach` safety net)
- [x] `e2e/tests/writer-profile.spec.ts` — live profile/stats load via the real
      single-call endpoint; `CONTRIBUTION_ACTIVITY`/`RECENT_ACTIVITY` confirmed
      genuinely absent from the DOM by default, not just CSS-hidden
- [x] Result: **9/9 tests passing**, full suite run ~16s
      (`.agent/tasks/e2e-platform-validation.exec.md` has the full run-by-run log)

### Open calls — reviewed, passed on for now (not production-scoped, deferred)
- [ ] `auth-service.ts:91`/`:120` — unguarded `window.google.accounts.id` access
      crashes `Login.ngOnInit()` when Google's script hasn't loaded yet, corrupting the
      login form's reactive bindings. Test suite works around it
      (`stubGoogleIdentity()` in `e2e/tests/helpers.ts`); production code untouched by
      decision. Judged an OAuth/Google Cloud integration issue solvable at the infra
      level (authorized origins / client configuration), not purely an app-code fix —
      deferred alongside the other polish items here, not fixed in this pass
- [ ] Broader E2E coverage (media upload, signup+OTP, search hybrid/AI mode, the
      async BullMQ-queue-driven paths) — deferred, not expanded this pass. The 9
      specs cover the scope map's highest-risk paths (auth, core CRUD, cross-service
      data loading), not full platform coverage
- [ ] Merge timing for `chore/e2e-platform-validation` — deferred, kept as its own
      branch for now rather than merged into `preview`/`main` immediately

---

## [Sprint 08] — 2026-W21 — Completed
**Theme: Writer Profile Data Layer**

### Completed — 08a: Data layer unblock
- [x] `node-backend` — Fix stats field name mismatch in /me/full-profile response:
      `mapProfileStats()` adapter in `profile.js` — totalPosts → posts, totalReach → reach,
      totalCoAuthored → coauth, since derived from profile.createdAt year;
      `Promise.allSettled` stats fallback extended to include totalCoAuthored
- [x] `node-backend` — Extended `getUserFavorites` populate select (authorAvatar, images,
      hashtags, isPublic, isDraft) — mirrors the Sprint 07 fix already applied to userPosts
- [x] `node-backend` — Added NODE_FEATURE_CONTRIBUTION_ACTIVITY and
      NODE_FEATURE_RECENT_ACTIVITY env vars to .env.example, provisioned for 08b
- [x] `node-backend` — /profile/me/full-profile integration test (Vitest): envelope shape,
      stats field mapping, partial-failure case (favorites query fails, still returns 200)
- [x] `ng-frontend` — Single-call `fetchFullProfile()` on RemoteApi — one HTTP round trip,
      not three (route's own `Promise.allSettled` already handles per-field resilience
      server-side, per-field client resilience would have duplicated that concern)
- [x] `ng-frontend` — WriterProfile rewired off MockApi — single subscribe, isLoading
      signal, CSS-initials avatar fallback (no `default-avatar.png` asset needed)
- [x] `ng-frontend` — Draft/fav template bindings fixed to live field names
      (draft.uuid/lastEditedAt, fav.uuid), empty-state messages for both panels
- [x] `ng-frontend` — Fav card thumbnail image + DRAFT badge — closed a gap the
      post-implementation audit found: the favorites select and `mapPost()` already
      surfaced images/isDraft, but the template never rendered them
- [x] `ng-frontend` — CONTRIBUTION_ACTIVITY and RECENT_ACTIVITY feature flags added to
      environment.ts/environment-prod.ts and feature-flags.json, template sections gated
- [x] `ng-frontend` — Draft row click → navigates to writer console with draft pre-loaded
- [x] `ng-frontend` — Scaffolded /dashboard/profile/edit and /dashboard/profile/saved
      child routes (empty shells, "Coming in Sprint 08b")

### Completed — Test Suite Fixes (found via post-implementation audit, not originally scoped)
- [x] `node-backend` — Fixed `vi.mock`/CJS-`require` interop bug breaking the auth mock in
      `post-crud.integration.test.js` (401 on 6/7 tests) and the crud/remotesearch/Post
      mocks in `search.integration.test.js` — `vi.mock(factory)` doesn't reliably intercept
      plain `require()` calls from already-loaded CJS route files under this Vitest setup;
      swapped both to the `require()` + `vi.spyOn().mockImplementation()` pattern, which
      patches the real module object in place
- [x] `node-backend` — Fixed stale `post-crud.integration.test.js` fixtures: `description`
      strings (42/46 chars) predated the Post model's `minlength: 120` constraint, masked
      until the auth mock fix let requests reach validation
- [x] `node-backend` — Fixed missing `await` on `queueService.getQueue()` in
      `analytics.integration.test.js` and `otp.integration.test.js` — surfaced once local
      Redis became available; also fixed the identical bug in **production code**
      (`eventLoggerService.js`'s `processAnalyticsBatch()`), silently masked by its own
      test's synchronous `mockReturnValue` instead of `mockResolvedValue`
- [x] `node-backend` — Updated stale `mailService`/`eventLoggerService` unit assertions for
      the `removeOnComplete`/`removeOnFail` options Sprint 07's BullMQ change added but
      never updated the tests for
- [x] Result: full `node-backend` suite — **8/8 test files, 32/32 tests passing**
      (baseline at sprint start: 5 failed/8 total files)

### Completed — OpenGraph / Social Preview Integration (reactive fix, not originally scoped)
- [x] `ng-frontend` — Fixed favicon MIME type mismatch (`.png` served as `image/x-icon`),
      added `favicon.ico` and `apple-touch-icon` links
- [x] `ng-frontend` — Added title (was 7 chars, now a proper 48-char title), meta
      description, full Open Graph, and Twitter Card tags to `index.html` — static, since
      the app has no SSR/prerendering and social crawlers don't execute JS
- [x] `ng-frontend` — Fixed a broken `og:image` fallback path in `post-detail.ts`
      (relative `assets/...` path that also 404'd — file lives at site root)
- [x] `ng-frontend` — Discovered `favicon-postair.png` (and separately, `postair-qr.png`)
      were generic "Poster Maker" stock/template placeholders, not real Postair branding —
      never previously verified visually. Generated a real Postair logomark and a proper
      1200×630 social banner, wired both in, added `og:image:alt`/`twitter:image:alt`,
      switched `twitter:card` to `summary_large_image` to match the banner's aspect ratio
- [x] Result: social preview audit score went from **9/100 to 86/100+** (title/description/
      image/OG tags all resolved; `postair-qr.png` in the footer is still the fake
      placeholder — separate, deferred below)

### Deferred to Sprint 09 — 08b: New UI (follow-on)
- [ ] `node-backend` — Heatmap data endpoint: daily post counts last 12 months
      via MongoDB aggregation pipeline
- [ ] `ng-frontend` — Contribution heatmap wired to live endpoint
- [ ] `ng-frontend` — Edit profile form: display name, bio, avatar upload
- [ ] `ng-frontend` — Saved insights list view (/dashboard/profile/saved)
- [ ] `ng-frontend` — Profile banner image upload

### Deferred to backlog (requires features not yet built, or found this sprint)
- [ ] Co-auth count (requires editors[] aggregation endpoint)
- [ ] Recent activity feed (requires activity log schema)
- [ ] Media: orphan cleanup nightly job (pending records older than 24h)
- [ ] Reader: Intersection Observer lazy load on post cards
- [ ] Reader: srcset responsive image variants
- [ ] `footer.html`'s `postair-qr.png` is fake "Poster Maker" placeholder branding, live on
      the actual site — needs a real QR asset once the target URL it should encode is decided
- [ ] `crud.js`'s `updatePost()` uses `findOneAndUpdate()` without `runValidators: true` —
      schema validation (e.g. description minlength) never runs on post updates
- [ ] Per-post social previews still show the site-default title/image/description to
      crawlers — `post-detail.ts`'s dynamic Meta/Title calls only run client-side; real
      per-post unfurls need SSR/prerendering or a bot-user-agent proxy

---

## [Sprint 07] — 2026-W17 — Completed
**Theme: Writer Console API + Media Management Base**

### Completed — Writer Console CRUD
- [x] `node-backend` — GET /myactivity/posts — list authenticated writer's own posts,
      extended userPosts projection with all WriterPost fields
- [x] `node-backend` — POST /myactivity/posts — create post with images[],
      cloudinaryPublicIds[], slug generation on publish, readTime on save,
      publishedAt set on first publish
- [x] `node-backend` — PUT /myactivity/posts/:uuid — update post, re-slug and
      set publishedAt on first publish transition
- [x] `node-backend` — DELETE /myactivity/posts/:uuid — delete post, auth-gated
- [x] `node-backend` — Tag management: Tag model, DAO, fuzzy search (Levenshtein),
      syncPostTags wired into create and update
- [x] `node-backend` — Post CRUD integration tests (Vitest) — 7 cases covering
      create draft, publish, list, update, delete, 404 on unknown uuid
- [x] `ng-frontend` — WriterConsole wired to live RemoteApi — mock data removed
      from data layer, posts loaded on init via fetchWriterPosts()
- [x] `ng-frontend` — onDraftSaved, onPostPublished, onDeletePost wired to
      RemoteApi — optimistic delete with signal restore on error
- [x] `ng-frontend` — RemoteApi: fixed createPost / updatePost / deletePost URLs
      to /myactivity prefix, added fetchWriterPosts + mapToWriterPost
- [x] `ng-frontend` — Form reset on save/publish — fields cleared, panel collapsed
      on success only
- [x] `ng-frontend` — Update-vs-create correctly distinguished on edit —
      post-edit emits WriterPost with uuid, shell calls updatePost not createPost
- [x] `ng-frontend` — Tag autocomplete: RxJS pipeline, 300ms debounce,
      20-char cap enforced at input time in post-form and post-edit
- [x] `ng-frontend` — Post-list: CSS flex layout — title truncates with ellipsis,
      action buttons pinned to right, never overflow container
- [x] `ng-frontend` — Auth guard confirmed on all writer dashboard routes

### Completed — Media Management Base
- [x] `node-backend` — Media mongoose model: mediaId, useruuid, cloudinaryId,
      url, folder, hash, status, type, sizeBytes, mimeType, uploadedAt, attachedAt
      Compound index on { hash, useruuid } for deduplication
- [x] `node-backend` — Media DAO: findMediaByHash, createMediaRecord,
      confirmMedia, attachMedia, deleteMedia
- [x] `node-backend` — Post model extended: cloudinaryPublicIds[] added
      alongside existing images[]
- [x] `node-backend` — Upload endpoint updated: folder structure
      postair/{useruuid}/{type}, postair_media Cloudinary preset,
      SHA-256 deduplication check before upload,
      returns { url, publicId, mediaId, exists }
- [x] `node-backend` — DELETE /myactivity/media/:mediaId — cloudinary.destroy +
      Media record status set to 'deleted'
- [x] `node-backend` — Rate limit on POST /myactivity/upload:
      20 requests per useruuid per 10 minutes (express-rate-limit)
- [x] `ng-frontend` — MediaService: hashFile() via Web Crypto SHA-256,
      uploadImage() sends hash + type, returns { url, publicId, mediaId }
- [x] `ng-frontend` — uploading signal in post-form and post-edit —
      Save Draft and Publish buttons disabled while uploading() is true
- [x] `ng-frontend` — cloudinaryPublicId and mediaId stored in component,
      included in save payload
- [x] `ng-frontend` — post-card and post-detail: default-post.png fallback
      when images[] is empty
- [x] `ng-frontend` — Cloudinary f_auto/q_auto injected into delivery URLs
      in post-card and post-detail carousel

### Completed — Infrastructure
- [x] `node-backend` — BullMQ Redis command volume reduced ~80%:
      removeOnComplete and removeOnFail on all workers and repeatable jobs
- [x] `node-backend` — Redis fallback to Render Key Value: probe Upstash on init,
      switch transparently on failure or rate-limit error (REDIS_FALLBACK_URL)

### Deferred to Sprint 08
- [ ] Writer profile data layer — see Sprint 08 above
- [ ] Reader: Intersection Observer lazy load on post cards
- [ ] Reader: srcset responsive image variants
- [ ] Media: orphan cleanup nightly job

---

## [Sprint 06] — 2026-W16 — Completed
**Theme: Writer Console UI — Panel System & Dashboard Architecture**

### Completed
- [x] `ng-frontend` — Dashboard refactored into `features/dashboard/` with
      named sub-components: shell, sidebar, writer-console, writer-profile
- [x] `ng-frontend` — Dashboard shell: full-width flex layout, Bootstrap col
      constraints removed, sidebar stretches full viewport height
- [x] `ng-frontend` — Dashboard data-access layer consolidated into shared
      `features/dashboard/data-access/` — WriterPost, WriterStats interfaces
- [x] `ng-frontend` — DashboardStateService scaffolded in `core/services/`
- [x] `ng-frontend` — Writer console: signal-based orchestrator with
      subcomponents — PostForm, PostList, PostEdit, PostPreview
- [x] `ng-frontend` — Writer console: panel-based expand/collapse window
      system matching approved UI design
- [x] `ng-frontend` — Writer console: cover image upload with live preview
      and remove button in both PostForm and PostEdit
- [x] `ng-frontend` — Writer console: action-row with flex-grow hover effect
      — Save Draft, Publish, Delete on single animated row
- [x] `ng-frontend` — Writer console: PostPreview uses real PostCard
      component from shared/ui via WriterPost → Post adapter
- [x] `ng-frontend` — Writer console: PostList client-side pagination,
      8 rows per page, prev/next at bottom
- [x] `ng-frontend` — Writer console: panel-ctrl global design token —
      square rounded buttons consistent across all panels
- [x] `ng-frontend` — Writer console: state transitions — edit mode collapses
      new post form, expands list; preview opened only via topbar toggle
- [x] `ng-frontend` — Writer profile: driven from UserService, ProfileService
      removed; profileResolver consumes userService.profile$ directly
- [x] `ng-frontend` — Shell: dashboard container height adjusted, component
      icons standardised, redundant headers removed

### Deferred
- [ ] Writer profile: Edit profile form — Sprint 08b
- [ ] Writer profile: Banner image upload — Sprint 08b

---

## [Sprint 05] — 2026-W15 — Completed
**Theme: Reader MVP — Post Model, Data Quality & UI Polish**

### Completed
- [x] `node-backend` — Post model extended: slug, publishedAt, readTime,
      hashtags, createdAt
- [x] `node-backend/utils` — generateSlug, computeReadTime utilities
- [x] `node-backend` — ETag + Cache-Control on /api/posts/:uuid
- [x] `node-backend` — /api/search/ai proxy — internal key never exposed
      to browser, FEATURE_AI_SEARCH flag guard
- [x] `data-utils` — backfill-published-at.js — backfilled publishedAt
      on all seeded posts
- [x] `python-search-api` — reseeded with on-scope engineering content
      and real images, Qdrant index rebuilt
- [x] `ng-frontend` — Post interface updated with new model fields
- [x] `ng-frontend` — TruncateWordsPipe, HashtagSlicePipe added
- [x] `ng-frontend` — Home card: CSS line-clamp, hashtag slice, publishedAt
- [x] `ng-frontend` — Quick view: readTime, publishedAt, 100-word excerpt
- [x] `ng-frontend` — Focus read: image carousel, all hashtags, dynamic fields
- [x] `ng-frontend` — URL slug navigation on post detail
- [x] `ng-frontend` — Hero section updated — new copy, contributor/writer CTAs
- [x] `ng-frontend` — Footer updated — contributor and writer Google Form links
- [x] `ng-frontend` — Postair description updated in footer
- [x] `ng-frontend` — Mobile quick view layout (≤600px) — Up next list,
      responsive breakpoint

### Deferred to backlog
- [ ] AI search results panel polish
- [ ] User interactions: likes, favourites, share
- [ ] View count increment on focus read open