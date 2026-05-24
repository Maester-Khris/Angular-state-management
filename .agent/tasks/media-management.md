# Task: media-management-base

## Scope
- [x] ng-frontend
- [x] node-backend
- [ ] python-search-api
- [ ] data-utils

## Role
You are a full-stack engineer fluent in Angular 17 (signals) and Node/Express.
You are implementing a media management pipeline for a content publishing platform.
You respect the service boundaries defined in `.agent/AGENTS.md`.
You never expose Cloudinary credentials or internal publicIds to the Angular bundle.

## Context

**Current upload flow:**
Angular post-form / post-edit
→ mediaService.uploadImage(file)
→ POST /myactivity/upload        (node-backend/routing/activity.js)
→ multer memoryStorage()
→ cloudinary.upload_stream()     (node-backend/services/cloudinary.js)
→ returns { url }
→ Angular stores url in cloudinaryUrl field
→ BUG: cloudinaryUrl never included in save payload (fixed in previous task)
→ POST /myactivity/posts — images[] stored in MongoDB

**Pain points:**
- No `publicId` returned or stored — post deletion cannot clean up Cloudinary
- No deduplication — same image uploaded multiple times on retry
- No folder structure — all uploads land in a flat `user_content/` folder
- No upload preset — no dimension cap, no format enforcement, no compression
- No rate limiting on upload endpoint
- `images[]` in Post model stores raw URLs only — `publicId` lost after upload
- No Media tracking collection — orphaned uploads accumulate silently
- No upload state in Angular — form buttons remain active during upload
- No default image fallback — posts with no image render broken

**Existing files to read before planning:**
- `node-backend/database/models/post.js`
- `node-backend/database/crud.js`
- `node-backend/routing/activity.js`
- `node-backend/services/cloudinary.js`
- `ng-frontend/src/app/core/services/media-service.ts`
- `ng-frontend/src/app/features/dashboard/writer-console/components/post-form/post-form.ts`
- `ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/post-edit.ts`
- `ng-frontend/src/app/features/post-detail/post-detail.ts`
- `ng-frontend/src/app/features/home/` — post card component

---

## Task

### Node (node-backend)

1. **Add Media mongoose model** — `node-backend/database/models/media.js`
   Fields:
mediaId:          String (uuid, unique, required)
useruuid:         String (required, indexed)
cloudinaryId:     String (required)        — public_id from Cloudinary
url:              String (required)        — secure_url from Cloudinary
folder:           String                   — full folder path used
hash:             String (indexed)         — SHA-256 hex, for deduplication
status:           String enum ['pending', 'confirmed', 'attached', 'deleted']
default: 'pending'
type:             String enum ['post', 'profile']
sizeBytes:        Number
mimeType:         String
uploadedAt:       Date default: Date.now
attachedAt:       Date
   Compound index on `{ hash, useruuid }` for deduplication lookup.

2. **Add Media DAO methods** — `node-backend/database/crud.js`
findMediaByHash(hash, useruuid)
→ Media.findOne({ hash, useruuid, status: { $in: ['confirmed','attached'] } })
createMediaRecord(data)
→ new Media(data).save()
confirmMedia(mediaId)
→ Media.findOneAndUpdate({ mediaId }, { status: 'confirmed' }, { new: true })
attachMedia(mediaId)
→ Media.findOneAndUpdate({ mediaId }, { status: 'attached', attachedAt: new Date() }, { new: true })
deleteMedia(mediaId)
→ Media.findOneAndUpdate({ mediaId }, { status: 'deleted' }, { new: true })

3. **Update Post model** — `node-backend/database/models/post.js`
   - Add `cloudinaryPublicIds: [String]` field alongside existing `images: [String]`

4. **Update upload endpoint** — `node-backend/routing/activity.js`
   - `POST /myactivity/upload`
   - Accept query param `type` — `'post'` | `'profile'` (default `'post'`)
   - Accept body field `hash` — SHA-256 hex sent by Angular
   - **Deduplication check first:** call `findMediaByHash(hash, useruuid)`
     - If found: return `{ exists: true, url, publicId: cloudinaryId, mediaId }` — skip upload
   - Folder structure: `postair/{useruuid}/{type}`
   - Stream buffer to Cloudinary with:
     - `folder`: as above
     - `upload_preset`: `postair_media` (configured in Cloudinary dashboard —
       max 1200px width, `f_auto`, `q_auto`, allowed formats: jpg/png/webp)
   - On Cloudinary success:
     - Create Media record: `{ mediaId: uuid(), useruuid, cloudinaryId: public_id, url: secure_url, folder, hash, status: 'confirmed', type, sizeBytes: req.file.size, mimeType: req.file.mimetype }`
   - Return: `{ exists: false, url, publicId: public_id, mediaId }`

5. **Add delete media endpoint** — `node-backend/routing/activity.js`
   - `DELETE /myactivity/media/:mediaId`
   - Look up Media record by `mediaId` and `useruuid` — return 404 if not found
   - Call `cloudinary.uploader.destroy(cloudinaryId)`
   - Call `deleteMedia(mediaId)`
   - Return 204

6. **Add rate limiting** — `node-backend/routing/activity.js`
   - Apply `express-rate-limit` to `POST /myactivity/upload` only
   - Limit: 20 requests per `useruuid` per 10 minutes
   - Key by `req.userId` (set by `authenticateJWT`)
   - Return 429 with `{ message: "Upload limit reached. Try again in 10 minutes." }`
   - Add `express-rate-limit` to `node-backend/package.json` if not already present

7. **Update POST /myactivity/posts** — `node-backend/routing/activity.js`
   - Accept `cloudinaryPublicIds: string[]` in body alongside `images: string[]`
   - Store both on the post document

### Angular (ng-frontend)

8. **Update MediaService** — `ng-frontend/src/app/core/services/media-service.ts`
   - Add `hashFile(file: File): Promise<string>` using Web Crypto API:
```typescript
     const buffer = await file.arrayBuffer();
     const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
     return Array.from(new Uint8Array(hashBuffer))
       .map(b => b.toString(16).padStart(2, '0')).join('');
```
   - Update `uploadImage(file, type)` signature to accept `type: 'post' | 'profile'`
   - Before calling `/upload`: hash the file, send `hash` and `type` as form fields
   - Return type: `{ url: string, publicId: string, mediaId: string, exists: boolean }`

9. **Add uploading signal** — `post-form.ts` and `post-edit.ts`
   - `uploading = signal(false)` — set true when upload starts, false on success or error
   - Disable Save Draft and Publish buttons while `uploading()` is true:
```html
     [disabled]="uploading()"
```
   - Show a visual indicator (spinner or "Uploading..." text) while `uploading()` is true

10. **Store publicId and mediaId** — `post-form.ts` and `post-edit.ts`
    - After upload success: store `cloudinaryUrl`, `cloudinaryPublicId`, `mediaId`
      as component fields
    - Include in save payload:
```typescript
      images:              [this.cloudinaryUrl],
      cloudinaryPublicIds: [this.cloudinaryPublicId],
```

11. **Default image fallback** — `post-form.ts`, `post-edit.ts`, post card template
    - If `images[]` is empty at display time, use `/assets/default-post.png`
    - In templates: `[src]="post.images?.[0] || '/assets/default-post.png'"`
    - Never upload `default-post.png` to Cloudinary — asset path only, never in `images[]`

12. **Cloudinary optimised delivery URLs** — post card and post-detail templates
    - For every Cloudinary URL rendered in the reader section, inject
      `/f_auto,q_auto/` transformation segment into the URL before rendering:
```typescript
      // In a pipe or helper:
      optimiseUrl(url: string): string {
        if (!url || !url.includes('cloudinary.com')) return url;
        return url.replace('/upload/', '/upload/f_auto,q_auto/');
      }
```
    - Apply in: post-card image, post-detail image carousel, quick-view image

---

## API contract
POST /myactivity/upload
Headers: Authorization: Bearer <token>
Query:   ?type=post|profile
Body:    multipart/form-data
file:  <binary>
hash:  <sha256 hex string>
Response 200 (deduplicated):
{ exists: true,  url: string, publicId: string, mediaId: string }
Response 201 (new upload):
{ exists: false, url: string, publicId: string, mediaId: string }
Response 429:
{ message: "Upload limit reached. Try again in 10 minutes." }
DELETE /myactivity/media/:mediaId
Headers: Authorization: Bearer <token>
Response: 204 No Content
Response: 404 { message: "Media not found" }

---

## Constraints
- Do not change the endpoint path of `POST /myactivity/posts` — only add fields to body
- Do not remove existing `images: string[]` from Post model — add `cloudinaryPublicIds` alongside
- Never expose Cloudinary API secret or upload preset name in Angular environment files
- `upload_preset` is passed server-side only — never in Angular
- `default-post.png` must exist in `ng-frontend/src/assets/` before referencing it
- Rate limiting applies to `POST /myactivity/upload` only — no other routes
- Node: use Vitest for any new test — no Jest
- No hardcoded secrets — use `process.env` / `environment.ts`
- Add `express-rate-limit` to `package.json` if not already listed

---

## Expected output

node-backend
- `database/models/media.js`         — new Media mongoose model
- `database/crud.js`                 — 5 new DAO methods
- `database/models/post.js`          — add cloudinaryPublicIds field
- `routing/activity.js`              — upload endpoint updated, delete endpoint added, rate limit added
- `package.json`                     — express-rate-limit added if missing
- `test.rest`                        — examples for POST /upload, DELETE /media/:id

ng-frontend
- `core/services/media-service.ts`              — hashFile, updated uploadImage return type
- `features/dashboard/writer-console/components/post-form/post-form.ts`  — uploading signal, publicId storage
- `features/dashboard/writer-console/components/post-edit/post-edit.ts`  — uploading signal, publicId storage
- `src/assets/default-post.png`                 — confirm file exists (do not generate)
- post card template                            — default image fallback + optimised URL
- post-detail template                          — optimised delivery URL in carousel

---

## Evaluation checklist
- [ ] Upload deduplication: same file uploaded twice returns `exists: true` on second call
- [ ] Cloudinary folder structure: `postair/{useruuid}/post/` confirmed in Cloudinary dashboard
- [ ] `cloudinaryPublicIds` present on saved post document in MongoDB
- [ ] Rate limit: 21st upload within 10 min returns 429
- [ ] Delete: Media record status = `'deleted'`, asset removed from Cloudinary
- [ ] Angular: Save/Publish buttons disabled while `uploading()` is true
- [ ] Angular: post with no image renders `default-post.png` not a broken img tag
- [ ] Reader URLs contain `/f_auto,q_auto/` transformation segment
- [ ] No Cloudinary credentials in any Angular file
- [ ] Existing tests pass

---

## Log

### Run 1 — 2026-W21
Output: Task created from system design session and codebase audit.
Gap: None — task reflects confirmed gaps from writer console audit.
Action: Execute Step 1 (data model) first — Node routes depend on Media model existing.