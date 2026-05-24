---
generated: 2026-04-13
source: tag-management.md
phases: 2
---

# Plan — Global Tag Management System

## Scope confirmation
Implement a centralized tag management system that supports efficient search, consistency (lowercase), and autocomplete functionality. The solution spans from the database level (dedicated Tag collection) to a fuzzy-search backend pipeline, and finally to an Angular-based autocomplete UI with caching.

## Files inventory
| Action | File | Reason |
|--------|------|--------|
| CREATE | node-backend/database/models/tag.js | New Mongoose model for tags |
| MODIFY | node-backend/database/crud.js | Add `searchTagsByPrefix`, `upsertTags`, and `getAllTags` DAO functions |
| CREATE | node-backend/services/tagService.js | Fuzzy search scoring (Levenshtein) and tag sync logic |
| CREATE | node-backend/routing/tags.js | REST endpoints for tag search and listing |
| MODIFY | node-backend/server.js | Register the new tag routes |
| MODIFY | node-backend/routing/activity.js | Wire `syncPostTags` into post creation and update flows |
| MODIFY | ng-frontend/src/app/core/services/remote-api.ts | Add HTTP client methods for tags |
| CREATE | ng-frontend/src/app/core/services/tag.service.ts | UI-level cache and search interface |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.ts | Integrate tag management pipeline |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.html | New tag input UI with suggestions |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.ts | Integrate tag management pipeline |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.html | New tag input UI with suggestions |

## Files that must not change
- Cross-package contracts (existing post payload structure must remain compatible)
- Auth middleware (`middleware/auth.js`)
- Python search api (this task is Node/Angular only)

## Service boundaries crossed
- Node backend exposes new `/api/tags` and `/api/tags/search` endpoints
- Angular frontend consumes these new endpoints

## Missing context
None — task is complete and well-defined.

## Phase breakdown

### Phase 1 — Node backend
Goal: Implement the database model, DAO, service logic (including fuzzy scoring), and REST routes.
Files:
- node-backend/database/models/tag.js
- node-backend/database/crud.js
- node-backend/services/tagService.js
- node-backend/routing/tags.js
- node-backend/server.js
- node-backend/routing/activity.js
Done when: `GET /api/tags/search` returns scored tags and `npm test` passes in node-backend.

### Phase 2 — Angular
Goal: Implement the frontend API service, caching layer, and the interactive tag input component (autocomplete/pills) in the writer console.
Files:
- ng-frontend/src/app/core/services/remote-api.ts
- ng-frontend/src/app/core/services/tag.service.ts
- ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.ts
- ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.html
- ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.ts
- ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.html
Done when: `ng build` passes and the tag input allows adding/removing tags with autocomplete suggestions.

## Risks
- **N+1 Queries**: Mitigated by using `bulkWrite` for tag sync.
- **Race conditions in autocomplete**: Mitigated by using `switchMap` in RxJS pipeline.
- **UI Blur vs Selection**: Mitigated by using `(mousedown)` instead of `(click)` on suggestion items.
