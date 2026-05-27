Few answers before writing the task:

---

**Aggregator endpoint vs 4 separate calls — for stats**

An aggregator pipeline on Node is the right call. A single `GET /profile/me/stats` that runs parallel DAO queries server-side via `Promise.all` is cleaner than 4 Angular HTTP calls. The client gets one response, one loading state, one error surface. MongoDB aggregation pipeline is the right tool for counts and sums — `$match → $group → $count` on the posts collection gives you totalPosts, totalDrafts, totalPublished, totalReach in one query. `since` comes from `user.createdAt` year — no aggregation needed, already in the user document from `getUserProfile`.

---

**Angular equivalent of `Promise.allSettled`**

`forkJoin` fails fast — if one Observable errors, the whole join errors. That's not what you want here.

Use `combineLatest` with `catchError` per stream:

```typescript
combineLatest({
  profile: remoteApi.fetchFullProfile().pipe(catchError(() => of(null))),
  drafts:  remoteApi.fetchWriterDrafts().pipe(catchError(() => of([]))),
  stats:   remoteApi.fetchProfileStats().pipe(catchError(() => of(null))),
  favs:    remoteApi.fetchWriterFavs().pipe(catchError(() => of([]))),
}).subscribe(({ profile, drafts, stats, favs }) => {
  // all four always resolve — nulls and empty arrays are safe fallbacks
});
```

Each stream has its own `catchError` — one failure never blocks the others. This is the RxJS equivalent of `allSettled`.

---

**Error interceptor**

Already exists at `node-backend/middleware/auth.js` on Node side. On Angular side confirm `error-interceptor.ts` is registered in `app.config.ts` — it should catch and log HTTP errors globally before they reach component-level `catchError`. Component-level `catchError` handles the fallback value, interceptor handles logging. Both play different roles — keep both.

---

Now the task:

```markdown
# Task: writer-profile-data-layer-08a

## Scope
- [x] ng-frontend
- [x] node-backend
- [ ] python-search-api
- [ ] data-utils

## Role
You are a full-stack engineer fluent in Angular 17 (signals, RxJS) and Node/Express.
You are wiring an existing static profile UI to live data.
You do not change any existing data model — Mongoose models and Angular interfaces
are read-only in this task.
You respect service boundaries defined in `.agent/AGENTS.md`.

## Context

Branch: `feat/writer-profile`

**Current state — WriterProfile component**
- All five signals consume MockApi:
  `mockApi.fetchUserProfile()`, `mockApi.fetchDrafts()`,
  `mockApi.fetchSavedInsights()`, `mockApi.fetchContributionData()`,
  `mockApi.fetchRecentActivity()`
- `profileResolver` populates `profileinit` from `route.snapshot.data`
  but the template never reads it — MockApi is used instead
- No RemoteApi methods exist for profile data
- `UserService.profile$` has hardcoded zero stats

**What exists on Node today**
- `GET /profile/me/full-profile` — returns `{ profile, stats, drafts, favorites }`
  via parallel `getUserProfile`, `getStats`, `getUserDrafts`, `getUserFavorites`
- Stats field names mismatch: Node returns
  `{ totalPosts, totalCoAuthored, totalReach }`,
  Angular `UserProfile.stats` expects `{ posts, reach, coauth, since }`
- `since` (member year) not returned by any endpoint — must be derived from
  `profile.createdAt` year server-side before returning

**Existing files to read before planning:**
- `node-backend/routing/profile.js`
- `node-backend/services/events-recorder.js` — getStats() lives here
- `node-backend/database/crud.js` — getUserProfile, getUserDrafts, getUserFavorites
- `ng-frontend/src/app/features/dashboard/writer-profile/writer-profile.ts`
- `ng-frontend/src/app/features/dashboard/data-access/profile.model.ts`
- `ng-frontend/src/app/core/services/remote-api.ts`
- `ng-frontend/src/app/core/interceptors/error-interceptor-interceptor.ts`
- `ng-frontend/src/app/app.config.ts` — confirm interceptor is registered

---

## Task

### Node (node-backend)

1. **Fix stats field names in `/profile/me/full-profile` response**
   - In `profile.js` — map the response before returning:
     ```javascript
     stats: {
       posts:  rawStats.totalPosts        || 0,
       reach:  rawStats.totalReach        || '0',
       coauth: rawStats.totalCoAuthored   || 0,
       since:  new Date(user.createdAt).getFullYear(),
     }
     ```
   - Do not change `getStats()` in `events-recorder.js` — adapt in the route handler only
   - Do not change any Mongoose model

2. **Add `NODE_FEATURE_CONTRIBUTION_ACTIVITY` and `NODE_FEATURE_RECENT_ACTIVITY`
   env vars to `node-backend/.env.example`:**
   ```
   NODE_FEATURE_CONTRIBUTION_ACTIVITY=false
   NODE_FEATURE_RECENT_ACTIVITY=false
   ```
   These are provisioned for future endpoints — no logic needed in Node this sprint.

### Angular (ng-frontend)

3. **Add three RemoteApi methods** — `ng-frontend/src/app/core/services/remote-api.ts`

   ```typescript
   // Returns mapped UserProfile shape
   fetchFullProfile(): Observable<UserProfile>

   // Returns WriterPost[] filtered to isDraft: true
   fetchWriterDrafts(): Observable<WriterPost[]>

   // Returns Post[] of user favourites
   fetchWriterFavs(): Observable<Post[]>
   ```

   All three call `GET /profile/me/full-profile` — the endpoint already returns
   all four data shapes in one response. Parse each field from the single response:
   - `fetchFullProfile()` → maps `res.profile + res.stats` to `UserProfile`
   - `fetchWriterDrafts()` → maps `res.drafts[]` to `WriterPost[]`
   - `fetchWriterFavs()` → maps `res.favorites[]` to `Post[]`

   Use the existing `mapPost()` and `mapToWriterPost()` private methods already
   in `remote-api.ts` for the mapping — do not duplicate mapping logic.

   **Stats adapter inside `fetchFullProfile()`:**
   ```typescript
   stats: {
     posts:  res.stats.posts,
     reach:  res.stats.reach,
     coauth: res.stats.coauth,
     since:  res.stats.since,
   }
   ```

4. **Rewire WriterProfile component**
   - `ng-frontend/src/app/features/dashboard/writer-profile/writer-profile.ts`
   - Inject `RemoteApi`, remove `MockApi` injection
   - Replace all five mock signals with `combineLatest` + per-stream `catchError`:

   ```typescript
   combineLatest({
     profile: this.remoteApi.fetchFullProfile().pipe(catchError(() => of(null))),
     drafts:  this.remoteApi.fetchWriterDrafts().pipe(catchError(() => of([]))),
     favs:    this.remoteApi.fetchWriterFavs().pipe(catchError(() => of([]))),
   }).subscribe(({ profile, drafts, favs }) => {
     this.profile.set(profile);
     this.drafts.set(drafts);
     this.favs.set(favs);
   });
   ```

   - `contributionData` and `account_activity` signals stay — set to empty arrays,
     never populated from API in this task
   - Add `isLoading = signal(true)` — set false after `combineLatest` resolves
     (success or error)
   - Error interceptor handles logging — component only handles fallback values

5. **Glassmorphism loading state per section**
   - While `isLoading()` is true, each section (profile card, stats block,
     drafts list, favs panel) shows a skeleton shimmer overlay
   - Use a CSS class `skeleton-loading` applied conditionally:
     `[class.skeleton-loading]="isLoading()"`
   - Add `.skeleton-loading` to the existing component CSS:
     ```css
     .skeleton-loading {
       position: relative;
       overflow: hidden;
       pointer-events: none;
     }
     .skeleton-loading::after {
       content: '';
       position: absolute;
       inset: 0;
       background: linear-gradient(
         90deg,
         rgba(255,255,255,0) 0%,
         rgba(255,255,255,0.06) 50%,
         rgba(255,255,255,0) 100%
       );
       backdrop-filter: blur(4px);
       animation: shimmer 1.4s infinite;
     }
     @keyframes shimmer {
       0%   { transform: translateX(-100%); }
       100% { transform: translateX(100%); }
     }
     ```

6. **Default image fallback for avatar**
   - If `profile()?.avatarUrl` is null or empty, use `/public/assets/default-avatar.png`
   - In template: `[src]="profile()?.avatarUrl || '/public/assets/default-avatar.png'"`
   - Confirm `default-avatar.png` exists in `ng-frontend/public/assets/` —
     do not generate or upload it, just reference it

7. **Default messages for empty states**
   - Drafts empty: `"No drafts yet — start writing from your console"`
   - Favs empty: `"No saved insights yet"`
   - Apply in template with `@if` / `@else` on the list length signal

8. **Feature flag gate — contribution grid and recent activity**
   - Add to `ng-frontend/src/environments/environment.ts`:
     ```typescript
     featureFlags: {
       contributionActivity: false,
       recentActivity:       false,
     }
     ```
   - Add to `ng-frontend/src/environments/environment.prod.ts`:
     ```typescript
     featureFlags: {
       contributionActivity: false,
       recentActivity:       false,
     }
     ```
   - In WriterProfile template, wrap contribution grid and recent activity sections:
     ```html
     @if (featureFlags.contributionActivity) {
       <!-- contribution grid -->
     }
     @if (featureFlags.recentActivity) {
       <!-- recent activity -->
     }
     ```
   - Import `environment` in the component and expose:
     `featureFlags = environment.featureFlags`

9. **Update `feature-flags.json`** — add two new entries:
   ```json
   "CONTRIBUTION_ACTIVITY": {
     "description": "Contribution heatmap grid on writer profile",
     "status": "planned",
     "sprint": "08b",
     "modules": ["ng-frontend", "node-backend"],
     "enabled_prod": false
   },
   "RECENT_ACTIVITY": {
     "description": "Recent activity timeline on writer profile",
     "status": "planned",
     "sprint": "08b",
     "modules": ["ng-frontend", "node-backend"],
     "enabled_prod": false
   }
   ```

---

## API contract

```
GET /profile/me/full-profile
Headers: Authorization: Bearer <token>
Response:
{
  profile: {
    useruuid:  string,
    name:      string,
    bio:       string | null,
    avatarUrl: string | null,
    createdAt: string (ISO date)
  },
  stats: {
    posts:  number,
    reach:  string,
    coauth: number,
    since:  number        ← year derived from createdAt, added this task
  },
  drafts:    WriterPost[],
  favorites: Post[]
}
```

No new endpoints. No endpoint path or HTTP method changes.

---

## Constraints
- Do not change any Mongoose model (`user.js`, `post.js`, `media.js`)
- Do not change `profile.model.ts` or `writer.models.ts` interfaces
- Do not change `getStats()` in `events-recorder.js` — adapt in route handler only
- Do not use `forkJoin` — use `combineLatest` with per-stream `catchError`
  so one failure never blocks other panels from rendering
- Error interceptor handles logging — do not add `console.error` in component
- `contributionData` and `account_activity` signals stay as empty arrays —
  no API call, no removal
- Never hardcode env values — use `environment.featureFlags`
- Default avatar image must exist in `public/assets/` before referencing —
  do not create or upload it, confirm path only

---

## Expected output

node-backend
- `routing/profile.js`          — stats field adapter + since field
- `.env.example`                — two new feature flag env vars

ng-frontend
- `core/services/remote-api.ts`                              — three new methods
- `features/dashboard/writer-profile/writer-profile.ts`      — MockApi removed,
                                                               combineLatest wiring,
                                                               isLoading signal,
                                                               featureFlags exposed
- `features/dashboard/writer-profile/writer-profile.html`    — skeleton class,
                                                               empty state messages,
                                                               feature flag gates
- `features/dashboard/writer-profile/writer-profile.css`     — skeleton-loading styles
- `environments/environment.ts`                              — featureFlags added
- `environments/environment.prod.ts`                         — featureFlags added
- `feature-flags.json`                                       — two new flag entries

---

## Evaluation checklist
- [ ] Profile card displays real name, bio, avatarUrl from MongoDB
- [ ] Stats block shows live posts, reach, coauth, since values
- [ ] Drafts list shows real draft posts or empty state message
- [ ] Favs panel shows real favourites or empty state message
- [ ] If one request fails, other sections still render with fallback values
- [ ] Glassmorphism shimmer visible during load, disappears after data resolves
- [ ] Contribution grid not visible in prod (`enabled_prod: false`)
- [ ] Recent activity not visible in prod (`enabled_prod: false`)
- [ ] No MockApi imports remain in writer-profile.ts
- [ ] No model changes — Mongoose and Angular interfaces unchanged
- [ ] Error interceptor registered in app.config.ts (confirm, do not change)

---

## Log

### Run 1 — 2026-W21
Output: Task created from audit report and architectural decision session.
Gap: Stats field mismatch and missing RemoteApi methods confirmed as primary blockers.
Action: Node stats adapter first — Angular wiring depends on correct field names.
```