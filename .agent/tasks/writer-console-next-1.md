# Task: wire-writer-console-post-crud-to-live-api

## Scope
- [x] ng-frontend
- [x] node-backend
- [ ] python-search-api
- [ ] data-utils

## Role
You are a full-stack engineer fluent in Angular 17 (signals) and Node/Express.
You wire an existing UI shell to live endpoints.
You key all post identity on `uuid`. Never use `title` as an identifier.

## Context

Branch: `feat/writer-console-api`

**What exists and works**
- Panel UI, expand/collapse, signal orchestration — done
- `POST /myactivity/posts` — exists, auth-gated, creates post in MongoDB
- `PUT  /myactivity/posts/:postuuid` — exists, auth-gated
- `DELETE /myactivity/posts/:postuuid` — exists, auth-gated
- `dbCrudOperator.userPosts(userId, page, limit)` — exists in `crud.js` section 5

**What is broken or missing**

`remote-api.ts` — three wrong URLs, all will 404:
  - `createPost` → `POST /posts`           (missing `/myactivity` prefix)
  - `updatePost` → `PUT  /posts/:id`       (missing `/myactivity` prefix)
  - `deletePost` → `DELETE /api/posts/:id` (wrong prefix)
  - `fetchWriterPosts` — method does not exist

`activity.js` — missing route:
  - `GET /myactivity/posts` does not exist — no way to list writer's own posts

`crud.js` — `userPosts` select incomplete:
  - Missing fields needed by WriterPost shape:
    `hashtags`, `isDraft`, `readTime`, `publishedAt`, `authorName`, `authorAvatar`

`writer-console.ts` — data layer is pure mock:
  - `posts` signal set from `getMockWriterPosts()` on init
  - `onDraftSaved()` — empty stub, no API call
  - `onPostPublished()` — empty stub, no API call
  - `onDeletePost(uuid)` — local signal removal only, no API call

**What must not change**
  - `getMockWriterPosts()` and `getMockWriterStats()` — leave imports and
    usage in place. They feed writer-profile static display. Do not remove.
  - Panel navigation logic in `writer-console.ts` — unchanged
  - `post-list.ts`, `post-preview.ts` — purely presentational, no changes
  - `post-store.ts` — do not touch, out of scope

## Task

Node (node-backend)
1. `crud.js` — extend `userPosts` select to include all WriterPost fields:

title description images hashtags isDraft isPublic uuid
readTime publishedAt createdAt lastEditedAt authorName authorAvatar

2. `activity.js` — add `GET /myactivity/posts` route after `router.use(authenticateJWT)`:
```javascript
   router.get('/posts', async (req, res) => {
     try {
       const page  = parseInt(req.query.page)  || 1;
       const limit = parseInt(req.query.limit) || 20;
       const posts = await dbCrudOperator.userPosts(req.userId, page, limit);
       res.json(posts);
     } catch (error) {
       res.status(500).json({ message: "Failed to fetch writer posts" });
     }
   });
```

Angular (ng-frontend)
3. `remote-api.ts` — fix three broken URLs:
   - `createPost` → `POST /myactivity/posts`
   - `updatePost` → `PUT  /myactivity/posts/:id`
   - `deletePost` → `DELETE /myactivity/posts/:id`

4. `remote-api.ts` — add `fetchWriterPosts()` and private `mapToWriterPost()`:
```typescript
   fetchWriterPosts(page = 1, limit = 20): Observable<WriterPost[]> {
     return this.http.get<any[]>(
       `${this.baseUrl}/myactivity/posts?page=${page}&limit=${limit}`
     ).pipe(map(posts => posts.map(p => this.mapToWriterPost(p))));
   }

   private mapToWriterPost(p: any): WriterPost {
     return {
       uuid:         p.uuid,
       title:        p.title,
       description:  p.description,
       hashtags:     p.hashtags     || [],
       images:       p.images       || [],
       status:       p.isDraft ? 'draft' : 'published',
       lastEditedAt: p.lastEditedAt || p.createdAt,
       publishedAt:  p.publishedAt,
       views:        p.views,
       readTime:     p.readTime,
       authorName:   p.authorName,
       authorAvatar: p.authorAvatar,
     };
   }
```

5. `writer-console.ts` — replace mock data layer with RemoteApi for CRUD only:
   - Inject `RemoteApi`
   - Add `ngOnInit` → call `remoteApi.fetchWriterPosts()` → set `posts` signal
   - Add `isLoading` and `error` signals
   - Wire `onDraftSaved(draft)`:
```typescript
     remoteApi.createPost({ ...draft, isPublic: false, isDraft: true })
     // on success: prepend to posts signal, update showList/showNewForm panels
```
   - Wire `onPostPublished(draft)`:
```typescript
     remoteApi.createPost({ ...draft, isPublic: true, isDraft: false })
     // on success: prepend to posts signal
```
   - Wire `onDeletePost(uuid)`:
```typescript
     // optimistic: remove from signal immediately
     // on error: restore snapshot, set error signal
     remoteApi.deletePost(uuid)
```
   - Keep `getMockWriterPosts()` and `getMockWriterStats()` imports —
     `stats` signal continues to use mock data, do not change it

## API contract
GET /myactivity/posts?page=1&limit=20
Headers: Authorization: Bearer <token>
Response: WriterPost[]
POST /myactivity/posts
Headers: Authorization: Bearer <token>
Body:   { title, description, hashtags, images, isPublic, isDraft }
Response: { uuid, title, createdAt, slug?, publishedAt? }
DELETE /myactivity/posts/:uuid
Headers: Authorization: Bearer <token>
Response: 204 No Content

## Constraints
- Do not remove `getMockWriterPosts()` or `getMockWriterStats()` from writer-console
- Do not touch `stats` signal — it stays on mock for this task
- Do not touch `post-store.ts`
- Do not change panel navigation logic
- All activity routes are already auth-gated by `router.use(authenticateJWT)` —
  do not add per-route middleware
- No hardcoded URLs — use `environment.nodeServiceUrl` as base

## Expected output

node-backend
- `database/crud.js`    — userPosts select extended
- `routing/activity.js` — GET /myactivity/posts added

ng-frontend
- `core/services/remote-api.ts`                         — URLs fixed, fetchWriterPosts added
- `features/dashboard/writer-console/writer-console.ts` — CRUD wired to RemoteApi

## Evaluation checklist
- [ ] `GET /myactivity/posts` returns posts array for authenticated user
- [ ] Saving a draft → post count increases in MongoDB (verify via GET /myactivity/posts)
- [ ] Publishing a post → post appears with `isPublic: true` in MongoDB
- [ ] Deleting a post → removed from MongoDB, UI restores on error
- [ ] No 404s on create / delete from Angular
- [ ] `getMockWriterPosts()` and `getMockWriterStats()` still imported and used for stats

## Log

### Run 1 — 2026-W21
Output: Task rescoped — CRUD wiring only, media and stats left untouched.
Gap: GET /myactivity/posts missing, three RemoteApi URLs broken, writer-console stubs empty.
Action: Apply Node changes first, then Angular.