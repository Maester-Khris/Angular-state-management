---
status: in-progress
phase: 2-of-2
assigned: claude-code
generated: 2026-04-06
---

# Execution brief — Quick View → Focus Read Navigation

## Session bootstrap
Read in this order before any action:
1. CLAUDE.md (repo root)
2. node-backend/CLAUDE.md
3. ng-frontend/CLAUDE.md
4. .agent/tasks/quick-to-focus-nav.md
5. .agent/tasks/quick-to-focus-nav.plan.md

## Current phase: Phase 1 — Node ETag support
Goal: Implement ETag and Cache-Control headers for the post detail endpoint.
Files: `node-backend/routing/home.js`
Done when: `curl -I http://localhost:3000/api/posts/:uuid` shows `ETag` and `Cache-Control` headers, and `If-None-Match` returns 304.

## Exact file list for this session
MODIFY  `node-backend/routing/home.js`

## Must not change this session
- Any frontend files (Phase 2)
- Database schema or models

## Build check
cd node-backend && npm test 2>&1 | tail -20

## Done when
- [ ] `curl -I http://localhost:3000/api/posts/:uuid` returns ETag and Cache-Control
- [ ] Second request with If-None-Match returns 304
- [ ] Build check passes with zero errors

## On completion
Update this file:
  phase: 1-of-2 → 2-of-2
  Append to Log:
  ### Run 1 — 2026-04-06
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [what the next session needs to know]

## Log

### Run 1 — 2026-04-06
Output: Added ETag and Cache-Control headers to GET /api/posts/:uuid in node-backend/routing/home.js. ETag derived from post.updatedAt timestamp (falls back to post._id). Returns 304 when If-None-Match matches. Cache-Control: private, max-age=300, must-revalidate.
Gap:    Full test suite (integration tests) requires Redis Stack container — infrastructure failed to start in this environment (pre-existing). Unit tests (15/15) passed. curl verification requires running server.
Action: Phase 2 is Angular navigation wiring. Read quick-view-content.component.ts, quick-view-container.component.ts, post-detail.ts, and app.routes.ts before writing any code.

## Hard stops
- Do not begin Phase 2 in this session even if Phase 1 finishes early
- Do not modify files outside the exact file list above
- If a required file is missing or unreadable, stop and report — do not guess
