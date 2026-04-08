# Task: Quick View → Focus Read Navigation

---
status: pending
phase: 1-of-2
assigned: claude-code
generated: 2026-04-06
---

## Scope
- [ ] Inspect Node `/api/posts/:uuid` endpoint for ETag support — add if missing
- [ ] Wire "Read full post" CTA in `QuickViewContentComponent` to navigate
      to `/post/:uuid`
- [ ] `FocusReadPage` (or `PostDetail`) performs full fetch with ETag caching
- [ ] Browser back from focus read returns to quick view with session intact
- [ ] Mobile "Read full post" button follows the same navigation contract

## Role
Full-stack engineer touching Node backend (ETag) and Angular frontend
(navigation wiring). Read the existing `PostDetail` component and the Node
`/api/posts/:uuid` route handler in full before writing anything.
Do not change `SessionQueueService` or the rail component.

## Context

### Navigation contract
```
Quick view  (/home/quick-view/:uuid)
  └── "Read full post" click
        → router.navigate(['/post', uuid])
              → FocusReadPage performs full fetch
              → browser back → quick view remounts
              → session queue still in memory (service is providedIn root)
              → ngOnInit re-syncs activeIndex from route param
```

### Why full fetch + ETag and not cache merge
- Post content (~100KB) was never fetched in the card payload
- ETag gives 304 Not Modified (0KB) if post unchanged since last focus read
- Simpler than a delta/merge endpoint — no new backend work beyond ETag header
- Posts are rarely edited mid-session so stale risk is negligible

### ETag behaviour
Node must set `ETag` and `Cache-Control` on the post response.
Angular's `HttpClient` sends `If-None-Match` automatically on subsequent
requests if the response was cached by the browser.
A 304 response means the browser returns the cached body — zero wire cost
for repeat visits to the same post in one session.

### Session persistence across navigation
`SessionQueueService` is `providedIn: 'root'` — it survives route changes.
When the user navigates back from focus read, `QuickViewContainerComponent`
remounts and `ngOnInit` finds the uuid in the existing queue and sets
`activeIndex` correctly. No extra work needed for web.

Mobile uses the same Angular router — same behaviour applies.

## Task

### Phase 1 — Node ETag support

Read `node-backend/routing/home.js` (or wherever `/api/posts/:uuid` lives).
Check if the response already includes an `ETag` header.

If ETag is absent, add it:
```javascript
const post = await dbCrudOperator.getPublicPostByUuid(req.params.uuid);
if (!post) return res.status(404).json({ message: 'Post not found' });

// Generate ETag from updatedAt timestamp or a hash of the content
const etag = `"${post.updatedAt?.getTime() ?? post._id}"`;

// Return 304 if client already has current version
if (req.headers['if-none-match'] === etag) {
  return res.status(304).end();
}

res.set({
  'ETag': etag,
  'Cache-Control': 'private, max-age=300, must-revalidate'
});
return res.status(200).json(post);
```

`max-age=300` = browser caches for 5 minutes.
`private` = CDN must not cache (post may be user-specific in future).
`must-revalidate` = after 5 min, browser revalidates before using cache.

Done when: `curl -I http://localhost:3000/api/posts/:uuid` shows
`ETag` and `Cache-Control` headers in the response.

### Phase 2 — Angular navigation wiring

**Step 1 — Read these files first:**
- `ng-frontend/src/app/features/quick-view/quick-view-content.component.ts`
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`
- `ng-frontend/src/app/features/post-detail/post-detail.ts`
- `ng-frontend/src/app/app.routes.ts` — confirm `/post/:uuid` route exists

**Step 2 — Wire the CTA in `QuickViewContentComponent`**

The component already has a `readFull` output. Verify it emits the uuid:
```typescript
@Output() readFull = new EventEmitter<string>();
```

In the template, verify the button calls it:
```html
<button (click)="readFull.emit(post.uuid)">Read full post →</button>
```

**Step 3 — Handle in `QuickViewContainerComponent`**
```typescript
onReadFull(uuid: string): void {
  this.router.navigate(['/post', uuid]);
  // replaceUrl: false — keep quick-view in history so back button works
}
```

Verify `[readFull]` output is bound in the container template:
```html
<app-quick-view-content
  [post]="currentPost()"
  (readFull)="onReadFull($event)">
</app-quick-view-content>
```

**Step 4 — Verify `/post/:uuid` route exists**

In `app.routes.ts`, confirm there is a top-level route:
```typescript
{
  path: 'post/:uuid',
  loadComponent: () =>
    import('./features/post-detail/post-detail').then(c => c.PostDetail)
}
```

If it does not exist, add it. If `PostDetail` is only a child of `home`,
it cannot be navigated to standalone — move it or add a second registration.

**Step 5 — `PostDetail` full fetch**

Read `post-detail.ts`. Confirm it fetches the post via `RemoteApi` using
the uuid from route params. The fetch should use `HttpClient` directly —
Angular's browser cache will handle ETag/304 automatically.

If `PostDetail` already fetches — no change needed.
If it reads from a resolver that caches — verify the resolver does not
bypass the HTTP cache.

**Step 6 — Mobile**

Mobile uses the same Angular router. The "Read full post" button in the
mobile "Up next" section (if implemented in Phase 2 of the previous task)
must also call `readFull.emit(post.uuid)` or navigate directly:
```typescript
onReadFullMobile(uuid: string): void {
  this.router.navigate(['/post', uuid]);
}
```

No separate mobile handling needed — the router works identically.

## Constraints
- Do not change `SessionQueueService`
- Do not change `QuickViewRailComponent`
- `replaceUrl` must be `false` on the focus read navigation so browser
  back returns to quick view
- Node ETag value must be deterministic — same post same ETag every time
- Do not add new npm packages to node-backend
- Both Node phases must pass build check before Angular work begins

## Expected Output
Phase 1:
1. `node-backend/routing/home.js` (or equivalent) — ETag + Cache-Control
   added to `/api/posts/:uuid` handler

Phase 2:
2. `ng-frontend/src/app/features/quick-view/quick-view-content.component.ts`
   — readFull output verified/wired
3. `ng-frontend/src/app/features/quick-view/quick-view-content.component.html`
   — button binding verified/corrected
4. `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`
   — onReadFull handler
5. `ng-frontend/src/app/features/quick-view/quick-view-container.component.html`
   — readFull binding
6. `ng-frontend/src/app/app.routes.ts` — /post/:uuid route confirmed/added

## Evaluation Checklist
- [ ] `curl -I localhost:3000/api/posts/:uuid` returns ETag and Cache-Control
- [ ] Second request with If-None-Match returns 304
- [ ] "Read full post" in quick view navigates to /post/:uuid
- [ ] Browser back from /post/:uuid returns to /home/quick-view/:uuid
- [ ] Session queue still populated after back navigation
- [ ] Active rail item still highlighted correctly after back navigation
- [ ] Mobile "Read full post" navigates to same route
- [ ] ng build passes with zero errors

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: