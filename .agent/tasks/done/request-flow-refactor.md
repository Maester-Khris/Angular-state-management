# Task 1: Route Angular AI Search Through Node Proxy

## Scope
- [ ] Add `POST /api/search/ai` proxy route to Node home router
- [ ] Update `fetchAiResults` in Angular `RemoteApi` to call Node instead of Python directly
- [ ] Remove `pythonBaseUrl` and `internalApiKey` from Angular environment files
- [ ] Tighten Python CORS to remove Angular origins from allowed list
- [ ] Zero changes to response shape — Angular `RemoteApi` service contract unchanged

## Role
Full-stack engineer. You are closing a security gap (internal key visible in browser
network tab) by moving the Python proxy responsibility to Node. Do not change any
response shape, RxJS stream logic, or component code. Read every file before editing.

## Context

### Current flow (insecure)
```
Angular → POST python:5000/search/ai   (X-Internal-Key visible in browser)
Angular → GET  node:3000/api/search    (unchanged, already secure)
```

### Target flow (secure)
```
Angular → POST node:3000/api/search/ai  (no key, no Python URL in browser)
Node    → POST python:5000/search/ai    (key in server env, never sent to browser)

Angular → GET  node:3000/api/search     (unchanged)
Node    → GET/POST python:5000/search   (unchanged)
```

Both Angular requests still fire simultaneously — parallelism is preserved.
Only the AI request URL changes. Everything else stays identical.

### Current `fetchAiResults` in Angular (to be updated)
```typescript
fetchAiResults(query: string, limit = 5): Observable<AiSearchResponse> {
  const pythonBaseUrl = (environment as any).pythonBaseUrl || 'http://localhost:5000';
  const internalKey   = (environment as any).internalApiKey || 'SECRET';

  return this.http.post<AiSearchResponse>(
    `${pythonBaseUrl}/search/ai`,
    { query, limit },
    { headers: { 'X-Internal-Key': internalKey } }
  ).pipe(
    catchError((err) => {
      console.error('AI Search Error:', err);
      return throwError(() => new Error('AI search unavailable'));
    })
  );
}
```

### Python response shape (must be preserved exactly)
```json
{
  "query": "string",
  "expanded_query": "string",
  "similar_docs": [
    { "uuid": "string", "title": "string", "description": "string", "score": 0.0 }
  ],
  "relevant_ext_docs": [
    {
      "source_url": "string",
      "source_name": "string",
      "source_small_headline": "string",
      "source_small_description": "string",
      "favicon": "string"
    }
  ]
}
```

Node must forward this response exactly as received — no transformation, no wrapping.

## Task

### 1. Read before editing
Read these files in full before making any change:
- `node-backend/routes/home.js` (or equivalent) — find `remoteSearchSvc`,
  `INTERNAL_API_KEY`, `pythonBaseUrl` config, and existing route patterns
- `ng-frontend/src/environments/environment.ts`
- `ng-frontend/src/environments/environment.prod.ts`
- `ng-frontend/src/app/core/remote-api.service.ts` (or equivalent)
- `python-search-api/app.py` — find the CORS `allowed_origins` configuration

### 2. Node — add `/api/search/ai` proxy route

Add the following route to the existing Node home router, alongside the existing
`/api/search` route. Use the same `PYTHON_SERVICE_URL` and `INTERNAL_API_KEY`
environment variables already used by the existing Python proxy calls in Node —
do not introduce new env variable names if equivalent ones already exist.
```javascript
router.post('/api/search/ai', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ message: "Search query 'query' is required" });
    }

    const pythonUrl = `${process.env.PYTHON_SERVICE_URL}/search/ai`;

    const pythonResponse = await fetch(pythonUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env.SHARED_SECURITY_KEY
      },
      body: JSON.stringify({ query, limit })
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.error(`Python AI search error ${pythonResponse.status}: ${errorText}`);
      return res.status(pythonResponse.status).json({
        message: 'AI search service error'
      });
    }

    // Forward Python response exactly — no transformation
    const data = await pythonResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('AI search proxy error:', error.message);
    return res.status(500).json({ message: 'AI search temporarily unavailable' });
  }
});
```

**Important:** Verify the env variable names against what already exists in the Node
codebase. Use the existing names — do not add new ones.

### 3. Angular — update `fetchAiResults`

Replace the method body only. The method signature, return type, and `AiSearchResponse`
interface must not change — `aiResults$` in `home.component.ts` depends on them.
```typescript
fetchAiResults(query: string, limit = 5): Observable<AiSearchResponse> {
  // Now calls Node proxy — key and Python URL never leave the server
  return this.http.post<AiSearchResponse>(
    '/api/search/ai',
    { query, limit }
    // No Authorization header — Node adds the internal key server-side
  ).pipe(
    catchError((err) => {
      console.error('AI Search Error:', err);
      return throwError(() => new Error('AI search unavailable'));
    })
  );
}
```

Use a relative URL (`/api/search/ai`) so it works in both local dev (via Angular proxy
config) and production without environment-specific base URLs.

### 4. Angular — remove secrets from environment files

In both `environment.ts` and `environment.prod.ts`, remove:
- `pythonBaseUrl`
- `internalApiKey`

Do not replace them with anything. If other parts of the codebase reference these
keys, list them in the Log section — do not silently delete usages.

### 5. Angular proxy config — verify local dev still works

Check `proxy.conf.json` (or `proxy.conf.js`) in the Angular project root.
Ensure `/api/search/ai` is covered by the existing proxy rule that forwards `/api`
to Node. If the proxy uses a catch-all `/api` rule it will work automatically.
If it uses explicit path entries, add:
```json
"/api/search/ai": {
  "target": "http://localhost:3000",
  "secure": false,
  "changeOrigin": true
}
```

### 6. Python — tighten CORS

In `python-search-api/app.py`, find the `allowed_origins` list and remove all
Angular-facing origins. Node is the only legitimate caller of Python.
```python
# BEFORE (approximate)
allowed_origins = [node_origin, angular_origin]

# AFTER — Angular no longer calls Python directly
allowed_origins = [node_origin]  # node_origin = NODE_SERVICE_URL env var

# Remove angular_origin from the list entirely
# Remove ANGULAR_SERVICE_URL from allowed_origins
# Keep the env var read if used elsewhere, just remove it from CORS
```

Also remove the local dev Angular origins from the `dev_origins` list:
```python
# Remove from dev_origins:
# "http://localhost:4200"
# "http://127.0.0.1:4200"
```

Node local dev origins (`localhost:3000`, `127.0.0.1:3000`) stay in the list.

## Constraints
- `AiSearchResponse` interface in Angular must not change
- `aiResults$` stream in `home.component.ts` must not change
- `home.component.html` and all component files must not change
- Node response body must be the raw Python JSON — no wrapping object, no extra fields
- Use existing Node env variable names — do not introduce new ones
- Relative URL in `fetchAiResults` — no hardcoded host
- Do not add `axios` or any new npm package to Node if `fetch` is available
  (Node 18+ has native fetch; verify Node version before choosing http client)

## Expected Output
1. `node-backend/routes/home.js` — new `/api/search/ai` route added
2. `ng-frontend/src/app/core/remote-api.service.ts` — `fetchAiResults` URL updated,
   secrets removed
3. `ng-frontend/src/environments/environment.ts` — `pythonBaseUrl` and `internalApiKey`
   removed
4. `ng-frontend/src/environments/environment.prod.ts` — same removals
5. `ng-frontend/proxy.conf.json` — verified or updated
6. `python-search-api/app.py` — Angular origins removed from CORS

## Evaluation Checklist
- [ ] Browser network tab shows `/api/search/ai` hitting Node — no direct Python URL visible
- [ ] `X-Internal-Key` header absent from all browser network requests
- [ ] `pythonBaseUrl` and `internalApiKey` absent from compiled `main.js` bundle
- [ ] AI search results still render correctly end-to-end
- [ ] Keyword and hybrid search unaffected
- [ ] Python returns 403 when called directly from browser (CORS blocks it)
- [ ] Local dev works via Angular proxy (`ng serve`)
- [ ] `ng build --prod` zero errors

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: