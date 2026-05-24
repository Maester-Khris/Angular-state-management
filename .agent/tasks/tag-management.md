# Task: Global Tag Management System

---
status: pending
phase: 1-of-2
assigned: claude-code
generated: 2026-04-11
---

## Scope
- [ ] Phase 1 — Node backend: Tag collection, DAO, service, routes
- [ ] Phase 2 — Angular: RemoteApi update, TagService cache, post-form
      and post-edit RxJS autocomplete pipeline

## Role
Phase 1: Node.js backend engineer — follow route → service → dao strictly.
Phase 2: Angular frontend engineer — signals, RxJS, OnPush components.
Read every referenced file before writing any code.

---

## Context

### Why a dedicated tag collection
Tags stored only as strings on Post documents cannot be searched efficiently,
cannot enforce lowercase consistency, and cannot support autocomplete without
full collection scans. A dedicated Tag collection with an index solves all three.

### Fuzzy search strategy
Two-step pipeline — MongoDB does prefix work, Node does scoring:
```
1. MongoDB regex ^query (case-insensitive, index-assisted) → top 20 candidates
2. Node Levenshtein distance on those 20 strings → sorted, top 5 returned
```
Levenshtein never runs inside MongoDB — it is always a Node-side concern.

### Tag sync on post save (bulkWrite)
On both create and update, Node syncs all tags in the post payload
using a single bulkWrite round trip — no N+1 queries:
```javascript
Tag.bulkWrite(tags.map(tag => ({
  updateOne: {
    filter: { name: tag.toLowerCase() },
    update: { $setOnInsert: { name: tag.toLowerCase() } },
    upsert: true
  }
})), { ordered: false })
```
`ordered: false` ensures a duplicate key on one tag does not abort others.

### Angular cache strategy
`Map<string, { results: Tag[], timestamp: number }>` in TagService.
Cache key is always `query.toLowerCase().trim()`.
TTL is 5 minutes. On cache miss, HTTP call fires and result is written
to cache before being emitted to the component.

### RxJS pipeline operators required
`debounceTime(300)` → `distinctUntilChanged()` →
`filter(q => q.trim().length >= 2)` → `switchMap` (cache first, then HTTP).
`switchMap` cancels in-flight requests when the user keeps typing.

### Tag submit gesture
- **Enter key** or **comma** adds the tag
- If tag exists in autocomplete list → selects it (no new tag created in component)
- If no match → added as free text to the post's tag array
- New tags are synced to the Tag collection on post save via bulkWrite

### Tag sync scope
Runs on both post **create** and post **update** in the Node service layer.

---

## Phase 1 — Node backend

### Step 1 — Read before writing
```
node-backend/database/models/
node-backend/database/crud.js
node-backend/services/
node-backend/routing/home.js (or equivalent)
node-backend/middleware/auth.js  ← find middleware function name
```

### Step 2 — Tag model

Create `node-backend/database/models/tag.js`:

```javascript
const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,   // enforced at schema level
    trim: true,
    index: true        // supports fast prefix regex queries
  }
}, {
  timestamps: false,
  collection: 'tags'
});

// Text index for Atlas Search fallback (optional, harmless on free tier)
TagSchema.index({ name: 'text' });

module.exports = mongoose.model('Tag', TagSchema);
```

### Step 3 — Tag DAO (crud.js)

Read `crud.js` to find the existing pattern (named exports, lean results).
Add these three functions — no business logic, no utils imports:

```javascript
const Tag = require('./models/tag');

// Prefix regex search — MongoDB-side filtering
// Returns lean plain JS objects, never Mongoose documents
async function searchTagsByPrefix(prefix, limit = 20) {
  const regex = new RegExp(`^${prefix}`, 'i');
  return Tag.find({ name: regex }).limit(limit).lean();
}

// Batch upsert — single round trip regardless of tag count
// ordered:false continues on duplicate key errors
async function upsertTags(tagNames) {
  if (!tagNames?.length) return;
  return Tag.bulkWrite(
    tagNames.map(name => ({
      updateOne: {
        filter: { name: name.toLowerCase().trim() },
        update: { $setOnInsert: { name: name.toLowerCase().trim() } },
        upsert: true
      }
    })),
    { ordered: false }
  );
}

// All tags — for initial load or full list
async function getAllTags() {
  return Tag.find({}).sort({ name: 1 }).lean();
}
```

Export all three alongside existing exports.

### Step 4 — Tag service

Create `node-backend/services/tagService.js`:

```javascript
const crud = require('../database/crud');

// Levenshtein distance — pure function, no dependencies
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 },
    (_, i) => Array.from({ length: b.length + 1 },
      (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

// Top N fuzzy search: prefix match in DB, Levenshtein scoring in Node
async function searchTags(query, topN = 5) {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];

  // Step 1: MongoDB prefix candidates (max 20)
  const candidates = await crud.searchTagsByPrefix(q, 20);

  // Step 2: Levenshtein scoring and sort
  const scored = candidates.map(tag => ({
    name: tag.name,
    score: levenshtein(q, tag.name)
  }));
  scored.sort((a, b) => a.score - b.score);

  // Return top N as plain string array
  return scored.slice(0, topN).map(t => t.name);
}

// Sync tags array to Tag collection — called on post create and update
async function syncPostTags(tags) {
  if (!tags?.length) return;
  return crud.upsertTags(tags);
}

async function getAllTags() {
  const tags = await crud.getAllTags();
  return tags.map(t => t.name);
}

module.exports = { searchTags, syncPostTags, getAllTags };
```

### Step 5 — Tag routes

Create `node-backend/routing/tags.js`:

```javascript
const express = require('express');
const router = express.Router();
const tagService = require('../services/tagService');
// Read middleware/auth.js to confirm the exact middleware name
const { verifyToken } = require('../middleware/auth');

// GET /api/tags/search?q=react
// Public — no auth required for autocomplete
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'Query must be at least 2 characters' });
  }
  try {
    const results = await tagService.searchTags(q);
    return res.status(200).json({ query: q, results });
  } catch (err) {
    return res.status(500).json({ message: 'Tag search failed' });
  }
});

// GET /api/tags — all tags for initial load
// Public
router.get('/', async (req, res) => {
  try {
    const tags = await tagService.getAllTags();
    return res.status(200).json({ tags });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch tags' });
  }
});

module.exports = router;
```

Register in `server.js` or wherever routes are mounted:
```javascript
const tagRoutes = require('./routing/tags');
app.use('/api/tags', tagRoutes);
```

### Step 6 — Wire syncPostTags into post service

Read the existing post service file. Find the create and update methods.
In each, after saving the post, call syncPostTags with the post's tags array:

```javascript
const { syncPostTags } = require('./tagService');

// Inside createPost service method, after post is saved:
await syncPostTags(postData.tags);

// Inside updatePost service method, after post is updated:
if (updateData.tags) await syncPostTags(updateData.tags);
```

Do not put syncPostTags in the route or in crud.js.

### Phase 1 build check
```bash
cd node-backend && npm test 2>&1 | tail -20
```

---

## Phase 2 — Angular

### Step 1 — Read before writing
```
ng-frontend/src/app/core/remote-api.service.ts
ng-frontend/src/app/core/services/  ← find existing services pattern
ng-frontend/src/app/features/dashboard/writer-console/components/post-form/
ng-frontend/src/app/features/dashboard/writer-console/components/post-edit/
ng-frontend/src/app/features/dashboard/data-access/writer.models.ts
```

### Step 2 — Update RemoteApi

Add to `remote-api.service.ts`:

```typescript
// Tag endpoints
searchTags(query: string): Observable<string[]> {
  return this.http.get<{ query: string; results: string[] }>(
    `${this.baseUrl}/api/tags/search`,
    { params: { q: query } }
  ).pipe(
    map(res => res.results),
    catchError(() => of([]))
  );
}

getAllTags(): Observable<string[]> {
  return this.http.get<{ tags: string[] }>(`${this.baseUrl}/api/tags`).pipe(
    map(res => res.tags),
    catchError(() => of([]))
  );
}
```

### Step 3 — TagService (Angular)

Create `ng-frontend/src/app/core/services/tag.service.ts`:

```typescript
@Injectable({ providedIn: 'root' })
export class TagService {
  private remoteApi = inject(RemoteApiService);
  private TTL = 5 * 60 * 1000; // 5 minutes

  private cache = new Map<string, { results: string[], timestamp: number }>();

  // Normalize all cache keys
  private key(query: string): string {
    return query.toLowerCase().trim();
  }

  getCached(query: string): string[] | null {
    const entry = this.cache.get(this.key(query));
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(this.key(query));
      return null;
    }
    return entry.results;
  }

  setCache(query: string, results: string[]): void {
    this.cache.set(this.key(query), { results, timestamp: Date.now() });
  }

  // Main search — cache first, HTTP fallback
  search(query: string): Observable<string[]> {
    const cached = this.getCached(query);
    if (cached) return of(cached);

    return this.remoteApi.searchTags(query).pipe(
      tap(results => this.setCache(query, results))
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

### Step 4 — Tag input mixin (shared logic)

Both post-form and post-edit need identical tag logic. Define it once
as a set of properties and methods to copy into each component —
do not create a base class, use composition via inject():

In each component .ts add:

```typescript
private tagService  = inject(TagService);
private destroy$    = new Subject<void>();

// Current tag input value
tagInput            = signal('');
// Suggestions from search
tagSuggestions      = signal<string[]>([]);
// Whether dropdown is visible
showSuggestions     = signal(false);

// RxJS pipeline — attach in ngOnInit
private tagInput$   = new Subject<string>();

ngOnInit(): void {
  this.tagInput$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    filter(q => q.trim().length >= 2),
    switchMap(q => this.tagService.search(q)),
    takeUntil(this.destroy$)
  ).subscribe(results => {
    this.tagSuggestions.set(results);
    this.showSuggestions.set(results.length > 0);
  });
}

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}

onTagInputChange(value: string): void {
  this.tagInput.set(value);
  if (value.trim().length >= 2) {
    this.tagInput$.next(value.trim());
  } else {
    this.tagSuggestions.set([]);
    this.showSuggestions.set(false);
  }
}

// Called when user selects from dropdown
selectTag(tag: string): void {
  if (!this.currentTags().includes(tag)) {
    this.addTagToList(tag);
  }
  this.tagInput.set('');
  this.tagSuggestions.set([]);
  this.showSuggestions.set(false);
}

// Called on Enter key or comma
onTagKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    const value = this.tagInput().trim().replace(',', '');
    if (!value) return;
    // If exact match in suggestions — select it
    const match = this.tagSuggestions().find(
      t => t.toLowerCase() === value.toLowerCase()
    );
    this.selectTag(match ?? value.toLowerCase());
  }
  if (event.key === 'Escape') {
    this.showSuggestions.set(false);
  }
}

removeTag(tag: string): void {
  this.updateTags(this.currentTags().filter(t => t !== tag));
}
```

`currentTags()` and `updateTags()` are component-specific — they read/write
the component's own tags signal. Define them per component:

```typescript
// post-form: reads/writes local form state
currentTags = computed(() => this.formTags());
updateTags(tags: string[]) { this.formTags.set(tags); }
addTagToList(tag: string) { this.formTags.update(t => [...t, tag]); }

// post-edit: reads/writes [post] input copy
currentTags = computed(() => this.editedTags());
updateTags(tags: string[]) { this.editedTags.set(tags); }
addTagToList(tag: string) { this.editedTags.update(t => [...t, tag]); }
```

### Step 5 — Tag input template (both components)

Replace the existing hashtag section in both post-form.html and
post-edit.html with:

```html
<div class="tag-section">
  <div class="tag-label">Hashtags</div>

  <!-- Selected tags as removable pills -->
  <div class="tag-pills">
    @for (tag of currentTags(); track tag) {
      <span class="tag-pill">
        #{{ tag }}
        <button type="button" class="tag-remove"
          (click)="removeTag(tag)">✕</button>
      </span>
    }
  </div>

  <!-- Input + dropdown -->
  <div class="tag-input-wrap">
    <input
      type="text"
      class="tag-input"
      placeholder="Add tag..."
      [value]="tagInput()"
      (input)="onTagInputChange($any($event.target).value)"
      (keydown)="onTagKeydown($event)"
      (blur)="showSuggestions.set(false)"
      autocomplete="off">

    @if (showSuggestions() && tagSuggestions().length > 0) {
      <div class="tag-dropdown">
        @for (suggestion of tagSuggestions(); track suggestion) {
          <div class="tag-suggestion"
            (mousedown)="selectTag(suggestion)">
            #{{ suggestion }}
          </div>
        }
      </div>
    }

    @if (tagInput().trim().length >= 2 && tagSuggestions().length === 0) {
      <div class="tag-dropdown">
        <div class="tag-new-hint"
          (mousedown)="selectTag(tagInput().trim().toLowerCase())">
          Create "#{{ tagInput().trim().toLowerCase() }}"
        </div>
      </div>
    }
  </div>
</div>
```

Note: `(mousedown)` instead of `(click)` on dropdown items — this fires
before `(blur)` on the input, preventing the dropdown from closing before
the selection registers.

### Step 6 — Tag section CSS (writer-console shared or per component)

```css
.tag-section { margin-bottom: 16px; }
.tag-label { font-size: 11px; font-weight: 500;
  color: var(--color-text-secondary); margin-bottom: 6px; }

.tag-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.tag-pill {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 3px 8px;
  background: var(--color-background-info);
  color: var(--color-text-info);
  border-radius: 12px; }
.tag-remove {
  background: none; border: none; cursor: pointer;
  font-size: 9px; color: var(--color-text-info);
  padding: 0; line-height: 1; }

.tag-input-wrap { position: relative; }
.tag-input {
  width: 100%; padding: 6px 10px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px; font-size: 12px; }

.tag-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px; z-index: 100;
  max-height: 160px; overflow-y: auto; }
.tag-suggestion, .tag-new-hint {
  padding: 8px 12px; font-size: 12px;
  color: var(--color-text-primary); cursor: pointer; }
.tag-suggestion:hover { background: var(--color-background-secondary); }
.tag-new-hint {
  color: var(--color-text-info);
  border-top: 0.5px solid var(--color-border-tertiary); }
.tag-new-hint:hover { background: var(--color-background-info); }
```

---

## Constraints
- Levenshtein runs only in Node tagService — never in MongoDB query,
  never in Angular
- All tags stored and compared as lowercase — enforced at schema level
  and at service level
- bulkWrite with ordered:false is the only acceptable tag sync method —
  no N separate findOrCreate calls
- syncPostTags lives in the post service layer — not in routing, not in crud
- Angular TagService cache keys must be normalized with toLowerCase().trim()
- switchMap is mandatory in the RxJS pipeline — no mergeMap or concatMap
- (mousedown) must be used on dropdown items, not (click)
- Do not import Tag model anywhere outside database/crud.js
- Do not add tagService calls to any home, reader, or quick-view component

## Expected Output

Phase 1:
1. `node-backend/database/models/tag.js`
2. `node-backend/database/crud.js` — three tag DAO functions added
3. `node-backend/services/tagService.js`
4. `node-backend/routing/tags.js`
5. `server.js` — tag routes registered
6. Post service — syncPostTags called on create and update

Phase 2:
7. `ng-frontend/src/app/core/remote-api.service.ts` — searchTags, getAllTags
8. `ng-frontend/src/app/core/services/tag.service.ts`
9. `post-form.ts` + `post-form.html` — tag pipeline + template
10. `post-edit.ts` + `post-edit.html` — tag pipeline + template

## Evaluation Checklist

Phase 1:
- [ ] Tag collection created with unique lowercase index
- [ ] `GET /api/tags/search?q=re` returns fuzzy-matched results
- [ ] `GET /api/tags/search?q=r` returns 400 (too short)
- [ ] Creating a post with tags syncs them to Tag collection
- [ ] Updating a post with new tags syncs only new ones (upsert)
- [ ] Duplicate tag in same post does not error (ordered:false)
- [ ] `npm test` passes

Phase 2:
- [ ] Typing 2+ chars triggers search after 300ms debounce
- [ ] Typing same query twice fires only one HTTP request
  (distinctUntilChanged)
- [ ] Rapid typing cancels previous in-flight requests (switchMap)
- [ ] Cache hit: second search of same query makes zero HTTP calls
- [ ] Enter or comma adds tag — no form submit triggered
- [ ] Selecting from dropdown adds tag and clears input
- [ ] "Create #newtag" option appears when no suggestions returned
- [ ] Tag removed with ✕ button
- [ ] Dropdown stays open on item click (mousedown over blur)
- [ ] `ng build --prod` zero errors

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: