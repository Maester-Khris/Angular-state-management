# Task 2: Feature Flag for AI Search

## Scope
- [ ] Add `FEATURE_AI_SEARCH` environment variable to Node
- [ ] Node `/api/search/ai` returns `503` immediately when flag is off
- [ ] Node exposes `/api/config` endpoint returning current feature flags
- [ ] Angular reads `/api/config` at app boot via `APP_INITIALIZER`
- [ ] Angular hides Ask AI button and skips `aiResults$` call when flag is off
- [ ] Flag is toggled in Vercel environment variables — zero code deploy required
- [ ] No client-side workaround can re-enable the feature when flag is off

## Role
Full-stack engineer. The flag must be enforced server-side — client-side hiding is
a UX convenience only, not the security gate. Read every file before editing.

## Context

### Why client-side gating is insufficient
`environment.ts` values are compiled into `main.js` and readable in the browser.
A user can set `isAiActive = true` in the console and trigger the request.
The actual gate must be on Node: if the flag is off, Node refuses the request
regardless of what Angular sends.

### Flag enforcement layers
```
Layer 1 (gate):    Node reads FEATURE_AI_SEARCH env var
                   → /api/search/ai returns 503 if false
                   → Angular catchError in aiResults$ handles it gracefully

Layer 2 (UX):      Angular reads /api/config at boot
                   → Ask AI button not rendered when flag off
                   → aiResults$ switchMap returns idle immediately when flag off
                   → No request is fired at all (saves the round trip)
```

Layer 1 alone is sufficient for security. Layer 2 is the UX polish.

### Vercel environment variable scoping
```
Production env:    FEATURE_AI_SEARCH=false   ← users see no AI feature
Preview env:       FEATURE_AI_SEARCH=true    ← your feature branch URL for testing
```

Toggling the flag on production requires: Vercel dashboard → Environment Variables
→ update value → Redeploy (or enable automatic redeploy on env var change).
No code change, no PR, no build.

## Task

### 1. Read before editing
- `node-backend/routes/home.js` — find the `/api/search/ai` route added in Task 1
- `node-backend/app.js` or `server.js` — find where routes are registered
- `ng-frontend/src/app/app.config.ts` — find existing providers to add initializer
- `ng-frontend/src/app/core/` — find where services live, follow naming convention

### 2. Node — guard `/api/search/ai` with flag

At the top of the route handler added in Task 1, add the flag check:
```javascript
// Read once at module load — no per-request overhead
const AI_SEARCH_ENABLED = process.env.FEATURE_AI_SEARCH === 'true';

router.post('/api/search/ai', async (req, res) => {
  // Layer 1 gate — server enforced, cannot be bypassed from browser
  if (!AI_SEARCH_ENABLED) {
    return res.status(503).json({
      error: 'disabled',
      message: 'AI search is not available'
    });
  }
  // ... rest of proxy logic unchanged from Task 1 ...
});
```

### 3. Node — add `/api/config` endpoint

Add to the home router (or a dedicated config router if one exists — follow the
existing pattern):
```javascript
router.get('/api/config', (req, res) => {
  res.status(200).json({
    features: {
      aiSearch: AI_SEARCH_ENABLED
    }
  });
});
```

This endpoint is public — no auth required. It exposes only boolean flags,
nothing sensitive. Angular reads it at boot.

### 4. Angular — `AppConfigService`

Create a new service following the project's existing service naming and folder
convention (likely `ng-frontend/src/app/core/app-config.service.ts`):
```typescript
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private http = inject(HttpClient);

  // Signal holding the resolved config
  // Default: all features off until server confirms otherwise
  readonly config = signal<AppConfig>({
    features: { aiSearch: false }
  });

  load(): Observable<AppConfig> {
    return this.http.get<AppConfig>('/api/config').pipe(
      tap(cfg => this.config.set(cfg)),
      catchError(() => {
        // On failure keep defaults (all off) — safe degradation
        console.warn('AppConfig load failed — defaulting all features to off');
        return of(this.config());
      })
    );
  }
}

export interface AppConfig {
  features: {
    aiSearch: boolean;
  };
}
```

### 5. Angular — wire `APP_INITIALIZER`

In `app.config.ts`, add the initializer so config is resolved before any route
or component renders:
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers unchanged ...
    provideAppInitializer(() => {
      const configSvc = inject(AppConfigService);
      // Returns Observable — Angular waits for it before bootstrapping
      return firstValueFrom(configSvc.load());
    }),
  ]
};
```

### 6. Angular — `SearchBarComponent` reads the flag

In `SearchBarComponent`, inject `AppConfigService` and expose the flag:
```typescript
private configSvc = inject(AppConfigService);

// Computed from server-resolved config — not from environment.ts
aiSearchAvailable = computed(() => this.configSvc.config().features.aiSearch);
```

In `SearchBarComponent` template, conditionally render the Ask AI button:
```html
<!-- Only rendered when server confirms flag is on -->
@if (aiSearchAvailable()) {
  <button class="ask-ai-btn" ...>
    Ask AI
  </button>
}
```

Do not use `[disabled]` — if the flag is off the button must not exist in the DOM.

### 7. Angular — `HomeComponent` skips AI request when flag is off

In `home.component.ts`, inject `AppConfigService` and guard the `aiResults$`
`switchMap`:
```typescript
private configSvc = inject(AppConfigService);

aiResults$ = this.searchQuery$.pipe(
  debounceTime(500),
  distinctUntilChanged(),
  switchMap(({ query, withAi }) => {
    // Skip entirely if server flag is off — no request fired
    const flagOn = this.configSvc.config().features.aiSearch;
    if (!flagOn || !withAi || !query.trim()) {
      return of({ state: 'idle' as const });
    }
    return this.RemoteApi.fetchAiResults(query).pipe(
      map(data  => ({ state: 'loaded' as const, data })),
      startWith(     { state: 'loading' as const }),
      catchError(()  => of({ state: 'error' as const,
                             message: 'AI search unavailable' }))
    );
  }),
  shareReplay(1)
);
```

### 8. Vercel — environment variable setup

Document in the repo `README` or a `docs/feature-flags.md` file:
```markdown
## Feature Flags

### FEATURE_AI_SEARCH
Controls the AI search path (Angular → Node → Python /search/ai).

| Environment | Value   | Effect                              |
|-------------|---------|-------------------------------------|
| Production  | `false` | Button hidden, endpoint returns 503 |
| Preview     | `true`  | Full AI search enabled for testing  |
| Local dev   | `true`  | Set in .env file                    |

To toggle on production:
1. Vercel dashboard → Project → Settings → Environment Variables
2. Update FEATURE_AI_SEARCH on Production environment
3. Trigger redeploy (Deployments tab → Redeploy latest)
No code change or PR required.
```

Add to `.env.example` in the Node service root:
```bash
FEATURE_AI_SEARCH=true   # set to false to disable AI search globally
```

## Constraints
- Flag enforcement on Node must happen before any Python call — not after
- Angular `APP_INITIALIZER` must use `firstValueFrom` — not `toPromise` (deprecated)
- `AppConfigService.config` must be a Signal — not a BehaviorSubject
- Ask AI button must be absent from DOM when flag off — not just `[disabled]`
- `aiResults$` must not fire any HTTP request when flag is off
- Do not add the flag to `environment.ts` — it belongs only in server env vars
- Do not change `AiSearchResponse` interface or any component template except
  the Ask AI button conditional render

## Expected Output
1. `node-backend/routes/home.js` — flag guard on `/api/search/ai`,
   new `/api/config` route
2. `ng-frontend/src/app/core/app-config.service.ts` — new service
3. `ng-frontend/src/app/app.config.ts` — `APP_INITIALIZER` added
4. `ng-frontend/src/app/features/search-bar/search-bar.component.ts`
   — `aiSearchAvailable` computed, injected config service
5. `ng-frontend/src/app/features/search-bar/search-bar.component.html`
   — Ask AI button wrapped in `@if (aiSearchAvailable())`
6. `ng-frontend/src/app/home/home.component.ts`
   — `aiResults$` guards on `flagOn`
7. `docs/feature-flags.md` — operational runbook
8. `node-backend/.env.example` — flag documented

## Evaluation Checklist
- [ ] `FEATURE_AI_SEARCH=false` on Node → `/api/search/ai` returns 503
- [ ] `/api/config` returns `{ features: { aiSearch: false } }` when flag off
- [ ] Angular boot resolves config before first render — no flash of Ask AI button
- [ ] Ask AI button absent from DOM when flag off (inspect Elements tab)
- [ ] No `/api/search/ai` request in Network tab when flag off
- [ ] Setting flag to `true` in Vercel + redeploy re-enables feature end-to-end
- [ ] If `/api/config` call fails, Angular defaults to flag off (safe degradation)
- [ ] Keyword and hybrid search unaffected by flag in either state
- [ ] `ng build --prod` zero errors

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: