## [Sprint 03] — 2026-W14 — Completed
**Theme: Quick View & Reading Session**

### Completed
- [x] `ng-frontend` — `SessionQueueService` — in-memory reading session queue,
      Signal-based, capped at 30 posts, FIFO eviction (no server state)
- [x] `ng-frontend` — Quick view overlay — child route `/home/quick-view/:uuid`
      mirrors existing focus read drawer pattern
- [x] `ng-frontend` — `QuickViewRailComponent` — left session rail, 260px,
      independent scroll, progress dots, author per row, keyboard hints
- [x] `ng-frontend` — `QuickViewContentComponent` — post preview, slide
      transition with direction, "Read full post" CTA
- [x] `ng-frontend` — Keyboard navigation — ↑↓ / J/K navigate rail,
      → opens focus read, Esc closes overlay, scroll-to-active
- [x] `ng-frontend` — Eye icon button on `PostCardComponent` — opens quick
      view without triggering focus read (stopPropagation)
- [x] `ng-frontend` — Reload guard — empty session queue redirects to /home
      with replaceUrl, no broken blank panel
- [x] `node-backend` — ETag + Cache-Control on `/api/posts/:uuid` —
      304 Not Modified on repeat visits within 5 min window
- [x] `ng-frontend` — Focus read navigation from quick view — full fetch
      strategy, browser back restores session queue intact
- [x] `node-backend` — `/api/search/ai` proxy route — internal key never
      exposed to browser, FEATURE_AI_SEARCH flag guard
- [x] Root — Doppler config — shared secrets centralised,
      per-service scoped tokens

### Known gaps carried to next sprint
- Post model missing `readTime`, `slug`, `hashtags` — rail shows author only
- Seeded data is off-topic (lifestyle posts) — search results polluted
- Mobile responsive layout (quick view below 600px) — deferred