---
generated: 2026-04-08
source: node-service-refactor.md
phases: 2
---

# Plan — Post Model Refactor

## Scope confirmation
Propagate schema changes for the Post model across the Node backend. Specifically, integrate `slug`, `publishedAt`, `readTime`, and `createdAt` into the CRUD, routing, and search layers.

## Files inventory
| Action | File | Reason |
|--------|------|--------|
| MODIFY | node-backend/database/models/post.js | Add `createdAt` field to schema. |
| MODIFY | node-backend/database/crud.js | Update `createPost`, `updatePost`, `getHomeFeed`, and projections to handle new fields and logic. |
| MODIFY | node-backend/routing/home.js | Update ETag logic to prioritize `publishedAt`. |
| CREATE | node-backend/tests/post.unit.test.js | New unit tests for slug generation, readTime computation, and guards. |

## Files that must not change
- `ng-frontend/` (Pure backend task)
- `python-search-api/` (Pure backend task)
- `node-backend/tests/auth.unit.test.js` (Pre-existing failures)
- `node-backend/tests/search.integration.test.js` (Pre-existing failures)

## Service boundaries crossed
None. Change is internal to `node-backend`.

## Missing context
None — task is complete.

## Phase breakdown

### Phase 1 — Service refactoring
Goal: Implement schema changes and logic in DAO and Routing layers.
Files: `node-backend/database/models/post.js`, `node-backend/database/crud.js`, `node-backend/routing/home.js`
Done when: Projections include new fields, `readTime` is computed, `slug`/`publishedAt` are set on publish, and Feed is sorted by `publishedAt`.

### Phase 2 — Unit test verification
Goal: Verify logic with new unit tests and ensure zero regressions.
Files: `node-backend/tests/post.unit.test.js`
Done when: New tests pass and existing tests (except known failures) pass.

## Risks
- Feed sorting change: Switching from `_id` to `publishedAt` might affect legacy posts without `publishedAt` if not handled (query filter `publishedAt: { $ne: null }` handles this but excludes old posts).
- Slug collision: `generateSlug` uses uuid suffix, so risk is minimal.
