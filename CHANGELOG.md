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

### Deferred to next sprint
- [ ] Writer console wired to live Node API (CRUD endpoints)
- [ ] Writer profile: Edit profile form (name, bio, avatar upload)
- [ ] Writer profile: Banner image upload

---

## [Sprint 07] — 2026-W17 — Current
**Theme: Writer Console API + Profile Light Fixes**

### Planned — writer console API (48h)
- [ ] `node-backend` — Post CRUD endpoints for authenticated writers:
      create, update, publish, unpublish, delete (`/api/writer/posts`)
- [ ] `node-backend` — Image upload endpoint (Cloudinary or equivalent)
- [ ] `node-backend` — Slug generation on publish, readTime on save,
      publishedAt set on first publish — wire to existing utils
- [ ] `ng-frontend` — WriterConsole wired to live API — replace mock data
      with RemoteApi calls, wire form submissions to endpoints
- [ ] `ng-frontend` — Auth guard confirmed on all writer routes
- [ ] Auth: Google Sign-In only — manual auth deferred

### Planned — profile UI light fixes (alongside API work)
- [ ] `ng-frontend` — Edit profile inline form: display name, bio, avatar upload
- [ ] `ng-frontend` — Profile banner image upload (same pattern as cover image)
- [ ] `ng-frontend` — Draft row arrow → navigates to writer console with
      that draft pre-loaded in edit panel

---

## [Sprint 08] — 2026-W18 — Planned
**Theme: Writer Profile Data Layer**

### Planned
- [ ] `node-backend` — Stats aggregation endpoint: post count, publishedAt
      range (since), reach sum (impressions per author)
- [ ] `node-backend` — Heatmap data endpoint: daily post counts last 12
      months via MongoDB aggregation pipeline
- [ ] `ng-frontend` — Profile stats block wired to live data
- [ ] `ng-frontend` — Contribution heatmap wired to live endpoint

### Deferred to backlog (requires features not yet built)
- [ ] Co-auth count (requires editors[] aggregation endpoint)
- [ ] Saved insights panel (requires bookmarks/favourites feature)
- [ ] Recent activity feed (requires activity log schema)

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