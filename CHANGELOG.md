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
- [ ] Mobile quick view layout (≤600px)
- [ ] User interactions: likes, favourites, share
- [ ] View count increment on focus read open

---

## [Sprint 06] — 2026-W16 — Current
**Theme: Writer & Admin — Authoring MVP**

### Planned
- [ ] `ng-frontend`, `node-backend` — Post creation: rich text editor,
      image upload, hashtag input, draft save
- [ ] `node-backend` — Publish flow: slug generation, publishedAt set on
      publish action, isPublic toggle
- [ ] Auth: Google Sign-In only — manual auth deferred
