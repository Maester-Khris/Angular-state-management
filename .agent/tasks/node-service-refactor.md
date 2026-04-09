# Task: Post Model — Propagate Schema Changes Across Node Backend

---
status: pending
phase: 2-of-2
assigned: claude-code
generated: 2026-04-08
---

## Scope
- [ ] Audit every file in `crud`, `dao`, `services`, `analytics`, `routing`
      that references the Post model and identify gaps against the new schema
- [ ] Add `slug`, `publishedAt`, `readTime`, `createdAt` to all relevant
      read, write, and query operations
- [ ] Wire `slug` generation (from `utils/functions.js`) into the publish flow
- [ ] Wire `readTime` computation into the create/update flow
- [ ] Set `publishedAt` explicitly on publish action — never auto-set
- [ ] No breaking changes to existing API response shapes consumed by Angular —
      only additive field additions

## Role
Node.js backend engineer. This is a pure backend task — do not touch
`ng-frontend` or `python-search-api`. Read every file listed in the
audit step before writing a single line. Follow existing patterns in
each file — do not introduce new abstractions.

## Context

### New Post schema fields
```javascript
slug:        String, unique, sparse, lowercase — set once on publish
publishedAt: Date, default null — set explicitly on publish action only
readTime:    Number (minutes), min 1 — computed from description word count
createdAt:   Date, immutable — creation timestamp
```

### Slug generation
Already implemented in `node-backend/utils/functions.js`.
Read that file first to understand the function signature and output format
before using it anywhere.

### readTime computation
```javascript
const { computeReadTime } = require('../utils/functions');
post.readTime = computeReadTime(post.description);
```
Compute in the service layer before save — not in a Mongoose hook,
not on the client.

### publishedAt vs isDraft vs isPublic
These three fields are intentionally independent:
- `isDraft: true` = not yet ready — slug may not exist
- `isDraft: false, isPublic: false` = ready but not public (scheduled future use)
- `isPublic: true` = live — `publishedAt` must be set at this moment if null
- `publishedAt` is set once, never overwritten on re-publish

### API response contract
Angular `RemoteApi` currently reads: `uuid`, `title`, `description`,
`authorName`, `authorAvatar`, `images`, `hashtags`, `isPublic`, `isDraft`,
`lastEditedAt`, `views`.

New fields are additive — do not remove or rename any existing field.
The home feed endpoint and post detail endpoint must continue returning
all existing fields plus the new ones.

## Task

### Phase 1 — Service refactoring

#### Step 1 — Full audit before any edit
Read every file in these directories and list which ones reference Post:

```
node-backend/database/          models, DAOs, seeders
node-backend/services/
node-backend/analytics/
node-backend/routing/
node-backend/utils/functions.js
```

For each file that touches Post, note:
- Does it SELECT posts? → must include new fields in projections if explicit
- Does it CREATE posts? → must compute readTime, set createdAt
- Does it UPDATE posts? → must handle publishedAt + slug on publish transition
- Does it QUERY posts for feed? → must sort/filter by publishedAt not createdAt
- Does it return post to client? → response shape must include new fields

Do not skip this step. Do not edit files before the audit is complete.

#### Step 2 — DAO / CRUD layer

Find the DAO file(s) responsible for post reads and writes.

**On post creation** — add before save:
```javascript
// readTime — computed from description
const wordCount = (post.description || '').split(/\s+/).filter(Boolean).length;
post.readTime = Math.max(1, Math.round(wordCount / 200));

// createdAt — set once, immutable in schema so subsequent saves ignore it
post.createdAt = post.createdAt ?? new Date();
```

**On publish action** (where `isPublic` is set to `true`):
```javascript
// Import slug generator — read utils/functions.js for exact function name
const { generateSlug } = require('../utils/functions');

// Set slug once — never overwrite if already set
if (!post.slug) {
  post.slug = generateSlug(post.title, post.uuid);
}

// Set publishedAt once — never overwrite
if (!post.publishedAt) {
  post.publishedAt = new Date();
}
```

**On description update** — recompute readTime:
```javascript
if (updateData.description) {
  const wc = updateData.description.split(/\s+/).filter(Boolean).length;
  updateData.readTime = Math.max(1, Math.round(wc / 200));
}
```

**Feed query** — if sorted by date, switch from `createdAt` / `_id` to
`publishedAt` descending. Only published posts appear in the public feed:
```javascript
// Feed filter must include publishedAt: { $ne: null }
// alongside existing isPublic: true filter
{ isPublic: true, publishedAt: { $ne: null } }
```

**Projections** — if any DAO uses explicit field projections (`.select()`
or projection objects), add the four new fields:
```javascript
.select('uuid title description authorName authorAvatar images hashtags
         isPublic isDraft lastEditedAt views slug publishedAt readTime createdAt')
```

#### Step 3 — Services layer

Read all files in `node-backend/services/`.

If any service wraps or transforms post objects before returning to routing,
ensure the new fields pass through. If the service constructs a post DTO
explicitly, add the four new fields to the DTO shape.

If `remotesearch.js` sends post data to Python for embedding, check whether
the payload includes description. If it does, no change needed — Python
embeds description which already exists.

#### Step 4 — Analytics layer

Read all files in `node-backend/analytics/`.

Analytics typically records `postId`, `userId`, event type. It should not
need changes unless it reads post fields directly. Confirm and note in the
log — no change if analytics only references post by id.

#### Step 5 — Routing layer

Read all files in `node-backend/routing/`.

**Post detail route** (`GET /api/posts/:uuid` or equivalent):
Confirm the response includes `slug`, `publishedAt`, `readTime`, `createdAt`.
If the route fetches via DAO and the DAO projection was updated in Step 2,
no further change is needed here. Verify the ETag is computed from
`publishedAt ?? updatedAt ?? _id` — `publishedAt` is now the canonical
"content version" timestamp for public posts.

**Feed / search routes**:
Confirm public feed filter includes `publishedAt: { $ne: null }`.
If search results are assembled from MongoDB results, confirm new fields
are present in the returned documents.

**Post create / update routes**:
Confirm the route handler passes description to the service/DAO so
`readTime` can be computed. If the route constructs the post object
directly, add the computation there.

**Publish route** (if separate from update):
This is the most important route to get right. Confirm:
1. `slug` is generated if absent
2. `publishedAt` is set if absent
3. `isPublic` is set to `true`
4. `isDraft` is set to `false`
All four must happen atomically in the same update operation.


### Phase 2 — Unit test verification

#### Step 1 — Read before writing
Read all six existing test files in full:
- `tests/analytics.integration.test.js`
- `tests/auth.unit.test.js`
- `tests/eventLoggerService.unit.test.js`
- `tests/mailService.unit.test.js`
- `tests/otp.integration.test.js`
- `tests/search.integration.test.js`

Note the import style, mock patterns, and describe/it structure used in
each file. All new tests must follow the same conventions exactly.

#### Step 2 — Do not fix pre-existing failures
Two tests are already failing before this task runs:

1. `tests/auth.unit.test.js` — `resendOtp > blocks resend after daily limit`
   receives `EMAIL_FAILED` instead of `DAILY_LIMIT` — pre-existing bug,
   not introduced by this task.

2. `tests/search.integration.test.js` — hoisting error: `createMock` accessed
   before initialization inside `vi.mock` factory — pre-existing Vitest
   hoisting violation, not introduced by this task.

**Do not touch either of these files.** Do not attempt to fix them.
The task evaluation counts only the new tests — the two pre-existing
failures are expected and ignored in the build check for this task.

#### Step 3 — Add new tests

Create `tests/post.unit.test.js` following the same structure as
`tests/eventLoggerService.unit.test.js` (unit test, mocked dependencies).

Cover the following cases:

**`computeReadTime` from `utils/functions.js`:**
```javascript
import { computeReadTime } from '../utils/functions.js';

it('returns 1 for empty string', () => {
  expect(computeReadTime('')).toBe(1);
});
it('returns 1 for null or undefined', () => {
  expect(computeReadTime(null)).toBe(1);
  expect(computeReadTime(undefined)).toBe(1);
});
it('computes correctly for known word count', () => {
  // 200 words → 1 min, 400 words → 2 min
  const text200 = Array(200).fill('word').join(' ');
  const text400 = Array(400).fill('word').join(' ');
  expect(computeReadTime(text200)).toBe(1);
  expect(computeReadTime(text400)).toBe(2);
});
it('rounds to nearest minute', () => {
  const text300 = Array(300).fill('word').join(' ');
  expect(computeReadTime(text300)).toBe(2); // 300/200 = 1.5 → rounds to 2
});
```

**`generateSlug` from `utils/functions.js`:**
```javascript
import { generateSlug } from '../utils/functions.js';

it('returns lowercase kebab string', () => {
  const slug = generateSlug('Hello World', 'abcd1234-5678-xxxx');
  expect(slug).toBe('hello-world-abcd1234');
});
it('strips special characters', () => {
  const slug = generateSlug('C++ & Python!', 'abcd1234-5678-xxxx');
  expect(slug).toMatch(/^[a-z0-9-]+$/);
});
it('is deterministic for same inputs', () => {
  const uuid = 'abcd1234-5678-xxxx';
  expect(generateSlug('Test Title', uuid)).toBe(generateSlug('Test Title', uuid));
});
it('does not overwrite existing slug', () => {
  // This tests the guard logic in the DAO — slug set once
  const slug1 = generateSlug('Original Title', 'abcd1234-xxxx');
  const slug2 = generateSlug('Updated Title', 'abcd1234-xxxx');
  // Slugs differ — DAO must use slug1 (the first), not slug2
  expect(slug1).not.toBe(slug2);
  // Guard behaviour is verified by mocking the DAO save —
  // confirm generateSlug is not called when post.slug already exists
});
```

**`publishedAt` guard (mock the DAO):**
```javascript
it('does not overwrite publishedAt on re-publish', () => {
  const original = new Date('2026-01-01');
  const post = { slug: 'existing-slug', publishedAt: original, isPublic: false };
  // Simulate publish logic
  if (!post.publishedAt) post.publishedAt = new Date();
  expect(post.publishedAt).toBe(original);
});
```

#### Constraints
- `computeReadTime` must be imported from `utils/functions.js` — never
  inline the word count calculation anywhere in the codebase
- Do not modify `tests/auth.unit.test.js` or `tests/search.integration.test.js`
  — both have pre-existing failures unrelated to this task


#### Evaluation
- [ ] `tests/post.unit.test.js` exists and all tests within it pass
- [ ] Pre-existing failures in auth and search test files are unchanged
      (same count, same error messages — not introduced by this task)

#### Step 4 — Build check

Run and confirm:
```bash
cd node-backend && npm test 2>&1 | tail -30
```

Expected result:
- `tests/post.unit.test.js` — all new tests pass
- `tests/auth.unit.test.js` — 1 pre-existing failure, unchanged
- `tests/search.integration.test.js` — 1 pre-existing failure, unchanged
- All other test files — pass unchanged