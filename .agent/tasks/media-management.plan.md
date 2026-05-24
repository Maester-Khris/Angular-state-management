---
generated: 2026-05-24
source: media-management.md
phases: 2
---

# Plan — Media Management Base

## Scope confirmation
Full media pipeline upgrade across Node and Angular:
add a Media mongoose model + DAO for tracking Cloudinary assets,
update the upload endpoint with deduplication, folder structure, and rate limiting,
add a delete endpoint, and wire Angular to send hash+type, store publicId/mediaId,
disable buttons during upload, and apply default image fallbacks + optimised delivery URLs.

## Files inventory
| Action | File | Reason |
|--------|------|--------|
| CREATE | node-backend/database/models/media.js | New Media mongoose model |
| MODIFY | node-backend/database/crud.js | 5 new Media DAO methods |
| MODIFY | node-backend/database/models/post.js | Add cloudinaryPublicIds field |
| MODIFY | node-backend/services/cloudinary.js | Return { url, publicId } instead of just url string |
| MODIFY | node-backend/routing/activity.js | Rewrite upload route, add delete route, add rate limit, update POST /posts body |
| MODIFY | node-backend/package.json | Add express-rate-limit dependency |
| MODIFY | node-backend/test.rest | Add upload and delete media examples |
| MODIFY | ng-frontend/src/app/core/services/media-service.ts | hashFile, updated uploadImage signature + return type |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.ts | uploading signal, publicId/mediaId fields, updated draft() payload |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.html | [disabled]="uploading()" on action buttons |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.ts | uploading signal, publicId/mediaId fields, updated build() payload |
| MODIFY | ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.html | [disabled]="uploading()" on action buttons |
| MODIFY | ng-frontend/src/app/features/dashboard/data-access/writer.models.ts | Add cloudinaryPublicIds?: string[] to WriterPost |
| MODIFY | ng-frontend/src/app/shared/ui/post-card/post-card.html | Default image fallback + optimised Cloudinary URL |
| MODIFY | ng-frontend/src/app/features/post-detail/post-detail.html | Optimised delivery URL in image carousel |

## Files that must not change
- node-backend/server.js — router mounts remain unchanged
- ng-frontend/src/app/features/home/home.ts — vm$ stream shape
- ng-frontend/src/app/core/remote-api.service.ts — Post interface and service methods
- ng-frontend/src/app/shared/ui/post-card/post-card.ts — no TS changes needed
- ng-frontend/src/app/features/post-detail/post-detail.ts — no TS changes needed
- ng-frontend/src/assets/default-post.png — already exists, do not modify

## Service boundaries crossed
- Angular → Node: POST /myactivity/upload request shape changes (adds hash, type query param); response shape changes (adds publicId, mediaId, exists)
- Angular → Node: POST /myactivity/posts body gains cloudinaryPublicIds field
- Node → Cloudinary: upload options gain folder, upload_preset

## Missing context
- upload_preset "postair_media" must be created in the Cloudinary dashboard before deploy.
  The code will reference it server-side only — no client exposure.
- express-rate-limit must be npm-installed after package.json update.

## Phase breakdown

### Phase 1 — Node backend
Goal: Add Media model, DAO methods, update Post model, rewrite upload endpoint, add delete endpoint, add rate limiting, update POST /posts to store cloudinaryPublicIds.
Files:
  CREATE  node-backend/database/models/media.js
  MODIFY  node-backend/database/crud.js
  MODIFY  node-backend/database/models/post.js
  MODIFY  node-backend/services/cloudinary.js
  MODIFY  node-backend/routing/activity.js
  MODIFY  node-backend/package.json
  MODIFY  node-backend/test.rest
Done when: server starts without error, upload endpoint returns { exists, url, publicId, mediaId }, delete endpoint returns 204, rate limiter is in place.

### Phase 2 — Angular frontend
Goal: Update MediaService with hashFile + new return type, add uploading signal to both form components, store publicId/mediaId, include them in save payloads, add default image fallback and optimised URL transformation to templates.
Files:
  MODIFY  ng-frontend/src/app/core/services/media-service.ts
  MODIFY  ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.ts
  MODIFY  ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.html
  MODIFY  ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.ts
  MODIFY  ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.html
  MODIFY  ng-frontend/src/app/features/dashboard/data-access/writer.models.ts
  MODIFY  ng-frontend/src/app/shared/ui/post-card/post-card.html
  MODIFY  ng-frontend/src/app/features/post-detail/post-detail.html
Done when: ng build passes with zero errors, buttons are disabled during upload, publicId is in save payloads, post cards show default-post.png when images is empty.

## Risks
- Existing upload route path is /upload (not /myactivity/upload). Angular already calls /myactivity/upload. The route path is corrected in Phase 1 — this is a fix, not a breaking change.
- req.userId is the MongoDB ObjectId (_id), not the user's useruuid string. Using req.userId.toString() as the useruuid field value in the Media model avoids an extra DB lookup and is stable per user.
- cloudinary.js currently returns a bare string. Changing to { url, publicId } is a breaking change within the service boundary — the upload handler in activity.js is updated in the same commit.
- express-rate-limit v7+ changed some API options (windowMs replaces window). Will use the current stable API.
- upload_preset must exist in Cloudinary dashboard for uploads to succeed in production. Uploads will fail with a Cloudinary error if the preset is missing — this is an ops prerequisite, not a code risk.
