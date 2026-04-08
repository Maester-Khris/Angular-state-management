# Task: Integrate Dual-Path AI Search into Angular Home & Search Bar

## Scope
- [ ] Update `SearchBarComponent` to emit a typed search event `{ query: string, mode: 'keyword' | 'hybrid', withAi: boolean }`
- [ ] Update `HomeComponent` data orchestration pipe to branch on search mode and pass `mode` param to Node
- [ ] Add a parallel `aiResults$` stream that fires only when `withAi === true` — calls Python `/search/ai` directly
- [ ] Render AI results (`similar_docs`, `relevant_ext_docs`) inside the **existing** `div.related-links-panel` in `home.component.html`
- [ ] Pass `mode` query param (`lexical` | `hybrid`) to the Node `/api/search` endpoint
- [ ] Preserve all existing fallback, infinite scroll, and health-check logic

## Role
Angular frontend developer with RxJS expertise. You are modifying an existing production Angular app.
Do not refactor working logic — extend it. Keep the existing `vm$` stream shape backward-compatible.

## Context

### Architecture
```
Angular → Node (/api/search?q=...&mode=hybrid|lexical)   [main feed, always]
Angular → Python (/search/ai)                             [AI panel, only when withAi=true]
```

Both requests fire in parallel when AI is active. The main feed does not wait for the AI panel.

### Search Model — 2 axes, not 3 modes
There are exactly **two orthogonal controls**:

| Control | Values | Effect |
|---|---|---|
| `mode` | `'keyword'` \| `'hybrid'` | Which Node search strategy to use (`lexical` vs `hybrid`) |
| `withAi` | `boolean` | Whether to additionally fire the Python `/search/ai` call and populate the AI panel |

`isAiActive` on `SearchBarComponent` maps directly to `withAi`. It does **not** change the `mode`.

### Current State (what exists, do not break)
- `SearchBarComponent` emits a raw `string` via `@Output() search = new EventEmitter<string>()`
- `isAiActive` is an `@Input()` on `SearchBarComponent` — wired in but not yet affecting the output
- `HomeComponent.onSearch(query: string)` pushes to `searchQuery$: BehaviorSubject<string>`
- `vm$` calls `RemoteApi.fetchPublicPosts(page, limit, query)` — no mode param today
- Node `/api/search` already accepts `?mode=hybrid|lexical` but Angular never passes it
- `div.related-links-panel` already exists in `home.component.html` — AI results slot into it

### Design Rules (must follow)
- AI panel content (`similar_docs`, `relevant_ext_docs`) renders inside **`div.related-links-panel`** — no new wrapper div
- Main feed results and AI panel results are fetched and rendered independently
- If Python is unreachable, AI panel shows a graceful degraded state; main feed is unaffected
- Empty query resets to the feed path (`/api/feed`), not the search endpoint

---

## Task

### 1. `SearchBarComponent`

**a. Define and export the event type**
```typescript
export type SearchMode = 'keyword' | 'hybrid';

export interface SearchEvent {
  query: string;
  mode: SearchMode;
  withAi: boolean;
}
```

**b. Change the output**
```typescript
// BEFORE
@Output() search = new EventEmitter<string>();

// AFTER
@Output() search = new EventEmitter<SearchEvent>();
```

**c. Wire `isAiActive` into the emitted event**
```typescript
onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  this.search.emit({
    query: value,
    mode: 'hybrid',        // default; can be extended later with a UI toggle
    withAi: this.isAiActive
  });
}
```

**d. Keep `clearSearch()` consistent**
```typescript
clearSearch() {
  this.searchInput.nativeElement.value = '';
  this.search.emit({ query: '', mode: 'hybrid', withAi: this.isAiActive });
}
```

---

### 2. `RemoteApi` service

**a. Update `fetchPublicPosts` signature**
```typescript
// BEFORE
fetchPublicPosts(page: number, limit: number, query?: string): Observable<FeedResponse>

// AFTER
fetchPublicPosts(
  page: number,
  limit: number,
  query?: string,
  mode: 'keyword' | 'hybrid' = 'hybrid'
): Observable<FeedResponse>
```

Inside the method:
- If `query` is non-empty → call `GET /api/search?q={query}&mode={mode === 'keyword' ? 'lexical' : 'hybrid'}&limit={limit}`
- If `query` is empty → call `GET /api/feed?cursor=...&limit=...` (unchanged)

**b. Add `fetchAiResults`**
```typescript
export interface AiSearchResponse {
  query: string;
  expanded_query: string;
  similar_docs: Array<{ uuid: string; title: string; description: string; score: number }>;
  relevant_ext_docs: Array<{ title: string; url: string; snippet: string }>;
}

fetchAiResults(query: string, limit = 5): Observable<AiSearchResponse> {
  return this.http.post<AiSearchResponse>(
    `${this.pythonBaseUrl}/search/ai`,
    { query, limit },
    { headers: { 'X-Internal-Key': this.internalKey } }
  ).pipe(
    catchError(() => throwError(() => new Error('AI search unavailable')))
  );
}
```

Both `pythonBaseUrl` and `internalKey` must be sourced from Angular environment files.

---

### 3. `HomeComponent`

**a. Update `searchQuery$` to carry mode and withAi flag**
```typescript
// BEFORE
searchQuery$ = new BehaviorSubject<string>('');

// AFTER
export interface SearchState {
  query: string;
  mode: 'keyword' | 'hybrid';
  withAi: boolean;
}
searchQuery$ = new BehaviorSubject<SearchState>({ query: '', mode: 'hybrid', withAi: false });
```

**b. Update `onSearch`**
```typescript
// BEFORE
onSearch(query: string) { this.searchQuery$.next(query); }

// AFTER
onSearch(event: SearchEvent) { this.searchQuery$.next(event); }
```

**c. Update `vm$` — main feed stream**

Destructure `{ query, mode }` from the search state. The `withAi` flag is irrelevant to this stream.
```typescript
vm$ = combineLatest([
  this.searchQuery$.pipe(debounceTime(500), distinctUntilChanged()),
  this.RemoteApi.dataChanged$.pipe(startWith(undefined)),
  this.RemoteApi.isAvailable$
]).pipe(
  switchMap(([{ query, mode }, _, isAvailable]) => {
    if (!isAvailable) {
      return of({ type: 'RESET' as const, query, posts: [], proposedLinks: [], isAvailable });
    }

    // Resolver fast-path (unchanged)
    if (this.currentPage === 0 && this.initialData.length > 0 && !query) {
      const posts = this.initialData;
      const proposedLinks = this.initialProposedLinks;
      this.initialData = [];
      this.initialProposedLinks = [];
      return of({ type: 'RESET' as const, query, posts, proposedLinks, isAvailable });
    }

    this.currentPage = 0;

    return this.RemoteApi.fetchPublicPosts(this.currentPage, this.limit, query, mode).pipe(
      map(result => ({
        type: 'RESET' as const,
        query,
        posts: result.posts,
        proposedLinks: result.proposedLinks,
        isAvailable
      })),
      startWith({ type: 'SET_LOADING' as const }),
      catchError((err) => {
        this.notifService.show(err.message || 'Failed to load posts.', 'error');
        return of({ type: 'RESET' as const, query, posts: [], proposedLinks: [], isAvailable });
      })
    );
  }),

  // loadMore$ — unchanged structure, reads mode from current searchQuery$ value
  mergeWith(
    this.loadMore$.pipe(
      switchMap(() => {
        this.currentPage++;
        const { query, mode } = this.searchQuery$.getValue();
        return this.RemoteApi.fetchPublicPosts(this.currentPage, this.limit, query, mode).pipe(
          map(result => ({ type: 'LOAD_NEXT' as const, posts: result.posts, proposedLinks: result.proposedLinks })),
          startWith({ type: 'SET_LOADING' as const }),
          catchError((err) => {
            this.notifService.show(err.message || 'Failed to load more posts.', 'error');
            return of({ type: 'STOP_LOADING' as const });
          })
        );
      })
    )
  ),

  // scan reducer — shape unchanged
  scan((state, action: any) => {
    switch (action.type) {
      case 'SET_LOADING':   return { ...state, loading: true };
      case 'STOP_LOADING':  return { ...state, loading: false };
      case 'RESET':
        return { ...state, posts: action.posts, proposedLinks: action.proposedLinks || [],
          query: action.query, loading: false,
          hasMore: action.posts.length === this.limit,
          isAvailable: action.isAvailable ?? state.isAvailable };
      case 'LOAD_NEXT':
        return { ...state,
          posts: [...state.posts, ...action.posts],
          proposedLinks: action.proposedLinks?.length ? action.proposedLinks : state.proposedLinks,
          loading: false, hasMore: action.posts.length === this.limit };
      default: return state;
    }
  }, { posts: [], proposedLinks: [], query: '', loading: false, hasMore: true, isAvailable: true }),

  shareReplay(1)
);
```

**d. Add `aiResults$` — independent, parallel stream**
```typescript
aiResults$ = this.searchQuery$.pipe(
  debounceTime(500),
  distinctUntilChanged(),
  switchMap(({ query, withAi }) => {
    if (!withAi || !query.trim()) {
      return of({ state: 'idle' as const });
    }
    return this.RemoteApi.fetchAiResults(query).pipe(
      map(data  => ({ state: 'loaded' as const, data })),
      startWith(     { state: 'loading' as const }),
      catchError(()  => of({ state: 'error' as const, message: 'AI search unavailable' }))
    );
  }),
  shareReplay(1)
);
```

---

### 4. `home.component.html`

**a. Update search bar binding**
```html
<!-- BEFORE -->
<app-search-bar (search)="onSearch($event)" [isAiActive]="true" />

<!-- AFTER -->
<app-search-bar (search)="onSearch($event)" [isAiActive]="isAiActive()" />
```

**b. Replace `div.related-links-panel` content with AI results**

Find the existing `div.related-links-panel` and replace its inner content with the AI panel.
Do not change the div's class, placement, or surrounding markup.
```html
<div class="related-links-panel">
  @if (aiResults$ | async; as ai) {

    @if (ai.state === 'loading') {
      <p class="related-links-panel__status">AI is analyzing your query…</p>
    }

    @if (ai.state === 'loaded') {
      @if (ai.data.similar_docs.length) {
        <section class="related-links-panel__similar">
          <h3 class="related-links-panel__heading">Related posts</h3>
          @for (doc of ai.data.similar_docs; track doc.uuid) {
            <a class="related-links-panel__item"
               (click)="openDetails(doc.uuid)"
               (keyup.enter)="openDetails(doc.uuid)"
               tabindex="0">
              {{ doc.title }}
            </a>
          }
        </section>
      }

      @if (ai.data.relevant_ext_docs.length) {
        <section class="related-links-panel__external">
          <h3 class="related-links-panel__heading">Web sources</h3>
          @if (ai.data.expanded_query) {
            <p class="related-links-panel__expanded-query">{{ ai.data.expanded_query }}</p>
          }
          @for (src of ai.data.relevant_ext_docs; track src.url) {
            <a class="related-links-panel__item"
               [href]="src.url"
               target="_blank"
               rel="noopener noreferrer">
              {{ src.title }}
            </a>
          }
        </section>
      }
    }

    @if (ai.state === 'error') {
      <p class="related-links-panel__status related-links-panel__status--error">
        {{ ai.message }}
      </p>
    }

  }
</div>
```

---

## API Contract

### Node — search (existing route, verify `mode` param is consumed)
```
GET /api/search?q={query}&mode=lexical|hybrid&limit={n}
Response: { query, mode, count, results[], meta: { mode, python_available } }
```

### Python — AI search (called directly from Angular)
```
POST /search/ai
Headers: X-Internal-Key: <env: INTERNAL_API_KEY>
Body:    { "query": string, "limit": number }
Response: {
  query:            string,
  expanded_query:   string,
  similar_docs:     [{ uuid, title, description, score }],
  relevant_ext_docs:[{ title, url, snippet }]
}
```

---

## Constraints
- Exactly **two search modes**: `keyword` → Node `lexical`, `hybrid` → Node `hybrid`
- `withAi` is a **boolean complement** to mode — it never changes which Node mode is used
- AI panel renders **inside the existing `div.related-links-panel`** only — no new wrapper divs
- Main feed (`vm$`) must not await `aiResults$` — they are fully independent streams
- `scan` reducer state shape must remain unchanged (downstream templates depend on it)
- `pythonBaseUrl` and `internalKey` must come from Angular environment files
- All new observables must be torn down on `ngOnDestroy` via `takeUntilDestroyed` or the existing destroy pattern
- `ng build --prod` must produce zero new errors or warnings

---

## Expected Output
1. `search-bar.component.ts` — updated `SearchEvent` type, output, and `onInput` / `clearSearch`
2. `remote-api.service.ts` — updated `fetchPublicPosts` signature + new `fetchAiResults` + `AiSearchResponse` interface
3. `home.component.ts` — updated `SearchState` type, `searchQuery$`, `onSearch`, `vm$`, new `aiResults$`
4. `home.component.html` — updated search bar binding + `div.related-links-panel` inner content

---

## Evaluation Checklist
- [ ] Keyword search fires `GET /api/search?q=...&mode=lexical` — confirmed in Network tab
- [ ] Hybrid search fires `GET /api/search?q=...&mode=hybrid` — confirmed in Network tab
- [ ] When `isAiActive=true`, both Node and Python requests fire in parallel (≤200ms apart in Network tab)
- [ ] When `isAiActive=false`, Python `/search/ai` is never called
- [ ] Main feed renders before `aiResults$` resolves
- [ ] AI results appear inside `div.related-links-panel` — no layout shift outside that element
- [ ] `div.related-links-panel` is empty / idle when query is empty or `withAi=false`
- [ ] AI panel shows graceful error when Python is unreachable; main feed unaffected
- [ ] Infinite scroll works after a search in both keyword and hybrid modes
- [ ] Empty query resets to `/api/feed`, not `/api/search`
- [ ] `ng build --prod` produces zero errors

---

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: