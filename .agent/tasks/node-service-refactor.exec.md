---
status: pending
phase: 2-of-2
assigned: claude-code
generated: 2026-04-08
---

# Execution brief — Post Model Refactor

## Session bootstrap
Read in this order before any action:
1. CLAUDE.md (repo root)
2. node-backend/CLAUDE.md
3. .agent/tasks/node-service-refactor,md (full task spec)
4. .agent/tasks/node-service-refactor.plan.md (full plan)

## Current phase: Phase 2 — Unit test verification
Goal: Verify logic with new unit tests and ensure zero regressions.
Files: `node-backend/tests/post.unit.test.js`
Done when: New tests pass and existing tests (except known failures) pass.

## Exact file list for this session
CREATE  node-backend/tests/post.unit.test.js

## Must not change this session
- ng-frontend/
- python-search-api/
- node-backend/tests/auth.unit.test.js
- node-backend/tests/search.integration.test.js

## Build check
cd node-backend && doppler run -- npm run test 2>&1 | tail -30

## Done when
- [ ] `tests/post.unit.test.js` exists and all 8 tests pass
- [ ] Logic for readTime, slug, and publishedAt guards verified
- [ ] Build check passes with zero new errors (ignoring 2 known pre-existing failures)

## On completion
Update this file:
  phase: 2-of-2 → complete
  Append to Log:
  ### Run 2 — 2026-04-08 (Phase 2)
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [what the next session needs to know]

## Log
### Run 1 — 2026-04-08 (Phase 1)
Output: Schema updated with `createdAt`. CRUD logic implemented for `readTime`, `slug`, and `publishedAt`. Projections updated across DAO. ETag logic fixed in `home.js`.
Gap:    None.
Action: Proceed to Phase 2 unit testing.

## Hard stops
- Do not modify files outside the exact file list above
- If a required file is missing or unreadable, stop and report — do not guess
