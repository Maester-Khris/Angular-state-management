---
status: done
phase: DONE
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

## Current phase: Phase 2 — Angular navigation wiring
Goal: Wire "Read full post" and add the top-level route.
Files:
- `ng-frontend/src/app/app.routes.ts`
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`

## Exact file list for this session
MODIFY `ng-frontend/src/app/app.routes.ts`
MODIFY `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`

## Must not change this session
- `node-backend/routing/home.js` (Phase 1 complete)
- `SessionQueueService` (Must remain root provider)
- `QuickViewRailComponent`

## Build check
cd ng-frontend && ng build 2>&1 | tail -20

## Done when
- [ ] Top-level `/post/:uuid` route mapping to `PostDetail` exists in `app.routes.ts`.
- [ ] `QuickViewContainerComponent`'s `onReadFull` correctly navigates to `/post/:uuid`.
- [ ] Browser back from `/post/:uuid` restores the quick view overlay with original session and scroll state.
- [ ] Build check passes with zero errors.

## On completion
Update this file:
  phase: 2-of-2 → DONE
  Append to Log:
  ### Run 2 — 2026-04-06
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [Final verification or cleanup]

### Run 2 — 2026-04-06
Output: Updated onReadFull in QuickViewContainerComponent to navigate to ['/home', 'view', uuid] using the existing child route. No new route added — PostDetail is already reachable at home/view/:uuid. ng build passes with zero errors.
Gap:    Task spec originally targeted /post/:uuid (new top-level route) but user confirmed the existing home/view/:uuid route should be used instead.
Action: Verify manually — click "Read full post" in quick view, confirm navigation to /home/view/:uuid and that browser back returns to quick view overlay.

## Log

### Run 1 — 2026-04-06
Output: Added ETag and Cache-Control headers to GET /api/posts/:uuid in node-backend/routing/home.js. ETag derived from post.updatedAt timestamp (falls back to post._id). Returns 304 when If-None-Match matches. Cache-Control: private, max-age=300, must-revalidate.
Gap:    Full test suite (integration tests) requires Redis Stack container — infrastructure failed to start in this environment (pre-existing). Unit tests (15/15) passed. curl verification requires running server.
Action: Phase 2 is Angular navigation wiring. Read quick-view-content.component.ts, quick-view-container.component.ts, post-detail.ts, and app.routes.ts before writing any code.

## Hard stops
- Do not modify core services or node-backend files.
- Ensure `replaceUrl: false` is used to preserve navigation history.
- If a required file is missing or unreadable, stop and report — do not guess.
