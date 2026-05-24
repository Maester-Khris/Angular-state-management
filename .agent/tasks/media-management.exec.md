---
status: pending
phase: 1-of-2
assigned: claude-code
generated: 2026-05-24
---

# Execution brief — Media Management Base

## Session bootstrap
Read in this order before any action:
1. CLAUDE.md (repo root)
2. node-backend/CLAUDE.md, ng-frontend/CLAUDE.md
3. .agent/tasks/media-management.md (full task spec)
4. .agent/tasks/media-management.plan.md (full plan)

## Current phase: Phase 1 — Node backend

Goal: Add Media model, DAO methods, update Post model, rewrite upload endpoint with deduplication + rate limit + delete endpoint, update POST /posts to accept cloudinaryPublicIds.

## Exact file list for this session
CREATE  node-backend/database/models/media.js
MODIFY  node-backend/database/crud.js
MODIFY  node-backend/database/models/post.js
MODIFY  node-backend/services/cloudinary.js
MODIFY  node-backend/routing/activity.js
MODIFY  node-backend/package.json
MODIFY  node-backend/test.rest

## Must not change this session
- node-backend/server.js
- Any ng-frontend file
- node-backend/database/crud.js existing methods (append only)

## Build check
cd node-backend && doppler setup --project postair --config test --no-interactive && doppler run -- npm run test 2>&1 | tail -20

## Done when
- [ ] node-backend/database/models/media.js exists with correct schema
- [ ] dbCrudOperator has findMediaByHash, createMediaRecord, confirmMedia, attachMedia, deleteMedia
- [ ] post.js has cloudinaryPublicIds: [String]
- [ ] cloudinary.js returns { url, publicId }
- [ ] POST /myactivity/upload returns { exists, url, publicId, mediaId }, applies rate limit, deduplicates
- [ ] DELETE /myactivity/media/:mediaId returns 204 or 404
- [ ] express-rate-limit in package.json
- [ ] test.rest has upload and delete examples
- [ ] Build check passes with zero errors

## On completion
Update this file:
  phase: 1-of-2 → 2-of-2
  Append to Log:
  ### Run 1 — 2026-05-24
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [what Phase 2 needs to know]

## Hard stops
- Do not begin Phase 2 in this session even if Phase 1 finishes early
- Do not modify files outside the exact file list above
- If a required file is missing or unreadable, stop and report
