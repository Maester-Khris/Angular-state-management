Few answers before writing the task:

---

**Aggregator endpoint vs 4 separate calls — for stats**

An aggregator pipeline on Node is the right call. A single `GET /profile/me/stats` that runs parallel DAO queries server-side via `Promise.all` is cleaner than 4 Angular HTTP calls. The client gets one response, one loading state, one error surface. MongoDB aggregation pipeline is the right tool for counts and sums — `$match → $group → $count` on the posts collection gives you totalPosts, totalDrafts, totalPublished, totalReach in one query. `since` comes from `user.createdAt` year — no aggregation needed, already in the user document from `getUserProfile`.

*(Superseded by Run 2 — see Revision Notes. The endpoint already exists and already aggregates server-side via `Promise.allSettled`. No new aggregation pipeline needed for 08a.)*

---

**Angular equivalent of `Promise.allSettled`**

~~Use `combineLatest` with `catchError` per stream against three separate RemoteApi calls.~~

**Superseded by Run 2.** The three-call `combineLatest` design was solving per-field resilience on the client — but `/me/full-profile` already solves that server-side with `Promise.allSettled` per DAO call, returning safe empty fallbacks (`{}`, `[]`) per field regardless of which one failed. Calling the same endpoint three times from Angular triples the network round trip for data that arrives in one response, and duplicates a resilience concern that's already handled at the right layer. Use a **single** `fetchFullProfile()` call; `catchError` at that one call only needs to handle total request failure (network/5xx/auth), not per-field failure. See Revision Notes below.

---

**Error interceptor**

Already exists at `node-backend/middleware/auth.js` on Node side. On Angular side confirm `error-interceptor-interceptor.ts` is registered in `app.config.ts` — confirmed present alongside `auth-interceptor-interceptor.ts`. Component-level `catchError` handles the fallback value, interceptor handles logging. Both play different roles — keep both.

---

## Revision notes — Run 2 (audit-driven corrections)

A full audit (`/audit ng-frontend writer-profile` + manual cross-reference against this spec) found the assumptions below were wrong when this spec was written, or that the original plan's own steps contradicted its own stated design. Fix these **before** writing wiring code — they're preconditions, not polish.

1. **Response envelope was assumed flat, it isn't.** `/profile/me/full-profile` returns `{ metadata: {...}, data: { profile, stats, drafts, favorites } }`, not a flat `{ profile, stats, drafts, favorites }`. This predates this spec (route unchanged since commit `396c9a5`) — the spec's API contract was wrong from the start, not drifted. **Resolution:** keep the envelope as-is (no route contract change, `metadata.latency`/`partialFailure` stay available for future observability use). Angular unwraps `res.data.*` — that's RemoteApi's job as the adapter layer between server DTOs and client view models, same role `mapPost()`/`mapToWriterPost()` already play.

2. **Three separate RemoteApi methods defeat the endpoint's own purpose.** The route's own comment calls it a "Single-trip profile loader... Reduces Frontend-to-Backend latency by aggregating all view-critical data" — but the original Task steps 3–4 have `fetchFullProfile()`, `fetchWriterDrafts()`, `fetchWriterFavs()` as three independent methods, all hitting the same GET, joined via `combineLatest` in the component. That's 3x the network calls for one page load, contradicting the Q&A preamble's own opening argument for a single response. **Resolution:** one RemoteApi method, one HTTP call, returns `{ profile, drafts, favs }` already mapped. Component does one `subscribe`, no `combineLatest` needed. Per-field resilience is unnecessary client-side because the server already guarantees it (see next point).

3. **Per-field `catchError` was solving an already-solved problem.** `profile.js` already wraps each DAO call in `Promise.allSettled` and returns safe fallbacks (`{}` for profile, `[]` for drafts/favorites) per field — a single failed DB query never brings down the response. The only remaining failure mode for Angular is the whole request failing (network, auth, 5xx), which legitimately should show one error state, not per-panel states.

4. **`avatar` vs `avatarUrl` naming was never resolved.** `UserProfile.avatar` (Angular model, unchanged per constraint) vs `avatarUrl` (Mongoose field, returned by `getUserProfile`). Original step 6 referenced `profile()?.avatarUrl`, which doesn't exist on the model. **Resolution:** map `avatarUrl` → `avatar` inside `fetchFullProfile()`. Model and template stay untouched.

5. **`default-avatar.png` doesn't exist** in `ng-frontend/public/assets/` — the spec assumed it did and said not to create one. **Resolution:** skip the image asset entirely — use a CSS initials avatar (first letters of `profile.name`, computed signal) as the empty state. No asset to source, no upload step, works for every name. See Angular step 6 below.

6. **`environment.prod.ts` doesn't exist** — renamed to `environment-prod.ts` in `1a79e18` (`fix(ng-frontend): correct prod env filename`), before this spec was written. Original step 8 targets the dead filename.

7. **Draft/fav template bindings are written against the old `Post`/mock shape, not `WriterPost`.** Template currently reads `draft.id`, `draft.lastModifiedAt`, `fav.id` — `WriterPost` has neither `id` nor `lastModifiedAt` (it has `uuid`, `lastEditedAt`); `Post` has no `id` either (optional `uuid` only), so `@for track` currently keys on `undefined` for every row once live data replaces mocks. Original spec's Angular file list included `writer-profile.html` but never called out these specific renames — now explicit in step 4 below.

8. **`getUserFavorites` under-selects fields `mapPost()` needs.** Populate select is `'title description uuid lastEditedAt authorName'` only — missing `images`, `hashtags`, `isPublic`, `isDraft`, `authorAvatar`, which `mapPost()` reads. Result: fav cards render with no image and always look "public" regardless of actual state. Sprint 07 already solved this exact problem for `userPosts` — same fix, applied to `getUserFavorites`.

9. **File path in original Context section was wrong.** `getStats()` lives in `node-backend/analytics/events-recorder.js`, not `node-backend/services/events-recorder.js`.

10. **Stats rejection fallback missing a field (minor, fix while touching the function anyway).** `profile.js`'s `Promise.allSettled` fallback for stats is `{ totalPosts: 0, totalReach: 0 }` — missing `totalCoAuthored`. Currently dead code (`getStats()` never actually rejects — it catches internally), but cheap to make consistent.

None of this changes scope — 08a is still data-layer-only, no new UI beyond what was already planned (skeletons, empty states, flag gates). It changes *how* the same outcomes are reached, and removes work (three methods → one; an asset to source → CSS instead).

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
- `GET /profile/me/full-profile` — returns
  `{ metadata: { latency, partialFailure, serverTime }, data: { profile, stats, drafts, favorites } }`
  via `Promise.allSettled` over `getUserProfile`, `getStats`, `getUserDrafts`, `getUserFavorites`
  — each DAO call already fails safe (`{}` / `[]`) independently; the endpoint always returns 200
- Stats field names mismatch: Node returns
  `{ totalPosts, totalCoAuthored, totalReach }`,
  Angular `UserProfile.stats` expects `{ posts, reach, coauth, since }`
- `since` (member year) not returned by any endpoint — must be derived from
  `profile.createdAt` year server-side before returning
- `profile.avatarUrl` (Mongoose field) must map to `UserProfile.avatar` (Angular field) —
  names differ, do not rename either side, map at the RemoteApi boundary

**Existing files to read before planning:**
- `node-backend/routing/profile.js`
- `node-backend/analytics/events-recorder.js` — `getStats()` lives here
- `node-backend/database/crud.js` — `getUserProfile`, `getUserDrafts`, `getUserFavorites`
- `ng-frontend/src/app/features/dashboard/writer-profile/writer-profile.ts`
- `ng-frontend/src/app/features/dashboard/data-access/profile.model.ts`
- `ng-frontend/src/app/features/dashboard/data-access/writer.models.ts` — `WriterPost` fields
- `ng-frontend/src/app/features/dashboard/data-access/post.model.ts` — `Post` fields
- `ng-frontend/src/app/core/services/remote-api.ts` — reuse `mapPost()`, `mapToWriterPost()`
- `ng-frontend/src/app/core/interceptors/error-interceptor-interceptor.ts`
- `ng-frontend/src/app/app.config.ts` — interceptor registration (confirmed present, do not change)

---

## Task

### Node (node-backend)

1. **Add a stats/profile mapper in `profile.js` and use it in the route handler**
   Keep it a small named function above the handler — presentation-layer shaping, not
   business logic, so it stays in the route file per project layering rules:
   ```javascript
   function mapProfileStats(rawStats, profile) {
     return {
       posts:  rawStats.totalPosts      ?? 0,
       reach:  String(rawStats.totalReach ?? '0'),
       coauth: rawStats.totalCoAuthored ?? 0,
       since:  profile.createdAt ? new Date(profile.createdAt).getFullYear() : null,
     };
   }
   ```
   Call it inside the existing handler: `stats: mapProfileStats(stats, profile)` — keep the
   `{ metadata, data }` envelope exactly as it is, do not flatten it.
   Also fix the `Promise.allSettled` stats fallback to include `totalCoAuthored: 0` for
   consistency with `getStats()`'s own fallback shape.
   - Do not change `getStats()` in `analytics/events-recorder.js` — adapt in the route only
   - Do not change any Mongoose model

2. **Extend `getUserFavorites` populate select in `crud.js`** to match what `mapPost()`
   needs — mirrors the Sprint 07 fix already applied to `userPosts`:
   ```javascript
   .populate({
     path: 'post',
     select: 'title description uuid lastEditedAt authorName authorAvatar images hashtags isPublic isDraft'
   })
   ```

3. **Add `NODE_FEATURE_CONTRIBUTION_ACTIVITY` and `NODE_FEATURE_RECENT_ACTIVITY`
   env vars to `node-backend/.env.example`:**
   ```
   NODE_FEATURE_CONTRIBUTION_ACTIVITY=false
   NODE_FEATURE_RECENT_ACTIVITY=false
   ```
   Provisioned for 08b endpoints — no logic needed in Node this sprint.

### Angular (ng-frontend)

4. **Add one RemoteApi method** — `ng-frontend/src/app/core/services/remote-api.ts`

   ```typescript
   fetchFullProfile(): Observable<{ profile: UserProfile; drafts: WriterPost[]; favs: Post[] }> {
     return this.http.get<any>(`${this.baseUrl}/profile/me/full-profile`).pipe(
       map(res => ({
         profile: {
           id:            res.data.profile.useruuid,
           name:          res.data.profile.name,
           bio:           res.data.profile.bio,
           avatar:        res.data.profile.avatarUrl,
           stats:         res.data.stats,
           savedInsights: [],
           recentActivity: [],
         },
         drafts: (res.data.drafts || []).map((p: any) => this.mapToWriterPost(p)),
         favs:   (res.data.favorites || []).map((p: any) => this.mapPost(p)),
       }))
     );
   }
   ```

   One call, one response — do not add separate `fetchWriterDrafts()`/`fetchWriterFavs()`
   methods; that was the original plan and it triples the request for data that already
   arrives together. Reuse the existing private `mapPost()` and `mapToWriterPost()` —
   do not duplicate their mapping logic.

5. **Rewire WriterProfile component**
   - `ng-frontend/src/app/features/dashboard/writer-profile/writer-profile.ts`
   - Inject `RemoteApi`, remove `MockApi` injection
   - Single subscribe, no `combineLatest`:
   ```typescript
   ngOnInit(): void {
     this.remoteApi.fetchFullProfile().pipe(
       catchError(() => of({ profile: null, drafts: [], favs: [] }))
     ).subscribe(({ profile, drafts, favs }) => {
       this.profile.set(profile);
       this.drafts.set(drafts);
       this.favs.set(favs);
       this.isLoading.set(false);
     });
   }
   ```
   - `contributionData` and `account_activity` signals stay — set to empty arrays,
     never populated from API in this task
   - Add `isLoading = signal(true)`, set false in the subscribe (success or fallback)
   - Error interceptor handles logging — component only handles the fallback value

6. **Glassmorphism loading state per section** — unchanged from original plan:
   `[class.skeleton-loading]="isLoading()"` with the shimmer CSS block, added to
   `writer-profile.css`.

7. **Avatar empty state — CSS initials, not an image asset**
   `default-avatar.png` does not exist and shouldn't be sourced for this. Add a computed
   initials fallback instead:
   ```typescript
   protected initials = computed(() => {
     const name = this.profile()?.name ?? '';
     return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
   });
   ```
   Template:
   ```html
   @if (profile()?.avatar) {
     <img [src]="profile()!.avatar" class="profile-avatar shadow" alt="Avatar">
   } @else {
     <div class="profile-avatar avatar-initials shadow">{{ initials() }}</div>
   }
   ```
   CSS: reuse the existing `.profile-avatar` sizing, add
   `.avatar-initials { display:flex; align-items:center; justify-content:center;
   background: var(--color-background-secondary); font-weight:600; }`

8. **Fix draft/fav template bindings to match live field names**
   In `writer-profile.html`:
   - Draft loop: `track draft.id` → `track draft.uuid`; `draft.lastModifiedAt` → `draft.lastEditedAt`
   - Fav loop: `track fav.id` → `track fav.uuid`
   (`WriterPost` has `uuid`/`lastEditedAt`; `Post` has `uuid`, not `id` — neither has `id`.)

9. **Default messages for empty states**
   - Drafts empty: `"No drafts yet — start writing from your console"`
   - Favs empty: `"No saved insights yet"`
   - Apply with `@if` / `@else` on the list length signal

10. **Feature flag gate — contribution grid and recent activity**
   - Add to `ng-frontend/src/environments/environment.ts` **and**
     `ng-frontend/src/environments/environment-prod.ts` (correct filename, not `.prod.ts`):
     ```typescript
     featureFlags: {
       contributionActivity: false,
       recentActivity:       false,
     }
     ```
   - Wrap contribution grid and recent activity sections in the template:
     ```html
     @if (featureFlags.contributionActivity) { <!-- contribution grid --> }
     @if (featureFlags.recentActivity) { <!-- recent activity --> }
     ```
   - `featureFlags = environment.featureFlags` on the component

11. **Update `feature-flags.json`** — add two new entries:
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

12. **Draft row → writer console navigation** — click on a draft row navigates to the
   writer console with that draft pre-loaded in the edit panel (unchanged from original plan;
   no discrepancy found here).

13. **Scaffold `/dashboard/profile/edit` and `/dashboard/profile/saved` child routes**
   — empty shells, unchanged from original plan.

---

## API contract

```
GET /profile/me/full-profile
Headers: Authorization: Bearer <token>
Response:
{
  metadata: { latency: string, partialFailure: boolean, serverTime: string },
  data: {
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
      since:  number | null   ← year derived from createdAt, added this task
    },
    drafts:    WriterPost[]  (raw Post documents, mapped client-side via mapToWriterPost),
    favorites: Post[]        (raw Post documents, mapped client-side via mapPost)
  }
}
```

No new endpoints. No endpoint path, HTTP method, or envelope changes.

---

## Constraints
- Do not change any Mongoose model (`user.js`, `post.js`, `media.js`)
- Do not change `profile.model.ts` or `writer.models.ts` interfaces
- Do not change `getStats()` in `analytics/events-recorder.js` — adapt in route handler only
- Do not flatten the `{ metadata, data }` envelope on the Node side
- One RemoteApi call for profile data — no `combineLatest`, no per-field HTTP round trips
- `contributionData` and `account_activity` signals stay as empty arrays —
  no API call, no removal
- Never hardcode env values — use `environment.featureFlags`
- No new image asset for the avatar fallback — CSS initials only

---

## Expected output

node-backend
- `routing/profile.js`      — `mapProfileStats` helper + envelope unchanged
- `database/crud.js`        — `getUserFavorites` select extended
- `.env.example`            — two new feature flag env vars

ng-frontend
- `core/services/remote-api.ts`                              — one new method, `fetchFullProfile()`
- `features/dashboard/writer-profile/writer-profile.ts`      — MockApi removed,
                                                                 single-subscribe wiring,
                                                                 isLoading signal,
                                                                 initials computed,
                                                                 featureFlags exposed
- `features/dashboard/writer-profile/writer-profile.html`    — skeleton class,
                                                                 initials avatar fallback,
                                                                 draft/fav field-name fixes,
                                                                 empty state messages,
                                                                 feature flag gates
- `features/dashboard/writer-profile/writer-profile.css`     — skeleton-loading + avatar-initials styles
- `environments/environment.ts`                               — featureFlags added
- `environments/environment-prod.ts`                          — featureFlags added (correct filename)
- `feature-flags.json`                                        — two new flag entries

---

## Evaluation checklist
- [ ] Profile card displays real name, bio, avatar from MongoDB (image or initials fallback)
- [ ] Stats block shows live posts, reach, coauth, since values
- [ ] Drafts list shows real draft posts (correct uuid/lastEditedAt binding) or empty state message
- [ ] Favs panel shows real favourites (with image, correct public/draft badge) or empty state message
- [ ] Only one HTTP request to `/profile/me/full-profile` per page load
- [ ] If the request fails entirely, the page falls back to safe empty state (not per-panel states)
- [ ] Glassmorphism shimmer visible during load, disappears after data resolves
- [ ] Contribution grid not visible in prod (`enabled_prod: false`)
- [ ] Recent activity not visible in prod (`enabled_prod: false`)
- [ ] No MockApi imports remain in writer-profile.ts
- [ ] No model changes — Mongoose and Angular interfaces unchanged
- [ ] Error interceptor registered in app.config.ts (confirm, do not change)
- [ ] `/me/full-profile` integration test covers: envelope shape, stats field mapping,
      and one partial-failure case (e.g. favorites query fails) still returning 200

---

## Log

### Run 1 — 2026-W21
Output: Task created from audit report and architectural decision session.
Gap: Stats field mismatch and missing RemoteApi methods confirmed as primary blockers.
Action: Node stats adapter first — Angular wiring depends on correct field names.

### Run 2 — 2026-W21 (audit + design review)
Output: `/audit ng-frontend writer-profile` cross-referenced against this spec surfaced
10 discrepancies (see Revision notes above) — most significantly, the response envelope
assumption was wrong from the start, and the original three-call `combineLatest` design
contradicted its own stated rationale for a single-trip aggregator endpoint.
Gap: Plan corrected in place — single `fetchFullProfile()` call replaces three methods,
`default-avatar.png` requirement replaced with CSS initials (asset never existed),
draft/fav template bindings corrected to live field names, `getUserFavorites` select
extended, `environment-prod.ts` filename corrected.
Action: Execute Node steps 1–3 first (stats mapper, favorites select, env vars — Angular
depends on correct field names and complete fields), then Angular steps 4–13 in order.
```
