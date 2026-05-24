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

### Deferred to Sprint 08
- [ ] Writer profile: Edit profile inline form (name, bio, avatar upload)
- [ ] Writer profile: Banner image upload
- [ ] Writer profile: Stats block wired to live aggregation endpoint
- [ ] Writer profile: Contribution heatmap wired to live endpoint
- [ ] Draft row arrow → navigates to writer console with draft pre-loaded
- [ ] Reader: Intersection Observer lazy load on post cards
- [ ] Reader: srcset responsive image variants
- [ ] Media: orphan cleanup nightly job (pending records older than 24h)

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
- [ ] `ng-frontend` — Edit profile inline form: display name, bio, avatar upload
- [ ] `ng-frontend` — Profile banner image upload
- [ ] `ng-frontend` — Draft row → navigates to writer console with draft pre-loaded

### Deferred to backlog (requires features not yet built)
- [ ] Co-auth count (requires editors[] aggregation endpoint)
- [ ] Saved insights panel (requires bookmarks/favourites feature)
- [ ] Recent activity feed (requires activity log schema)

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

### Deferred to next sprint
- [ ] Writer profile: Edit profile form (name, bio, avatar upload)
- [ ] Writer profile: Banner image upload

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