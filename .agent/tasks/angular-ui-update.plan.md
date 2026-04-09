---
generated: 2026-04-09
source: angular-ui-update.md
phases: 3
---

# Plan — Angular Post Model Sync + UI Enrichment

## Scope confirmation
Sync the Angular `Post` interface with new backend fields and enhance the UI across several surfaces (Home, Quick View, Focus Mode) with specific truncation and display rules. This also includes a data backfill for existing seeded posts.

## Files inventory
| Action | File | Reason |
|--------|------|--------|
| CREATE | data-utils/backfill-published-at.js | Standalone backfill script |
| MODIFY | ng-frontend/src/app/core/remote-api.service.ts | Update Post model |
| CREATE | ng-frontend/src/app/shared/pipes/truncate-words.pipe.ts | New truncation pipe |
| CREATE | ng-frontend/src/app/shared/pipes/hashtag-slice.pipe.ts | New hashtag slice pipe |
| MODIFY | ng-frontend/src/app/shared/ui/post-card/post-card.component.html | Home card UI |
| MODIFY | ng-frontend/src/app/shared/ui/post-card/post-card.component.scss | Home card styles |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-content.component.html | Quick view content UI |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-rail.component.html | Quick view rail UI |
| MODIFY | ng-frontend/src/app/features/post-detail/post-detail.component.html | Focus mode UI |
| MODIFY | ng-frontend/src/app/features/post-detail/post-detail.component.scss | Focus mode styles |

## Files that must not change
- Existing fields in `Post` interface must not be removed or renamed.
- Component logic unrelated to these specific UI rules.
- Backend routing or services (except for the standalone script).

## Service boundaries crossed
None — this is a frontend enrichment and a standalone data utility.

## Missing context
None — task is complete.

## Phase breakdown

### Phase 1 — Backfill publishedAt
Goal: Ensure all public posts have a `publishedAt` date for future query re-enabling.
Files: `data-utils/backfill-published-at.js`
Done when: Zero posts in the collection have `publishedAt: null` or missing.

### Phase 2 — Angular Service & Pipes
Goal: Support the new post model in the frontend and add utility pipes.
Files: `remote-api.service.ts`, `truncate-words.pipe.ts`, `hashtag-slice.pipe.ts`
Done when: `ng build --prod` passes and pipes are integrated.

### Phase 3 — UI Updates
Goal: Implement specific display and truncation rules across the 3 main surfaces.
Files: `post-card`, `quick-view`, `post-detail` components.
Done when: Visual requirements (truncation, hashtags, carousel) are met and confirmed.

## Risks
- Data backfill must not corrupt existing data (using a standalone script with MongoClient).
- UI truncation logic must not break responsiveness or accessibility.
