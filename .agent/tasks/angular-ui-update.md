# Task: Angular Post Model Sync + UI Enrichment

---
status: pending
phase: 1-of-3
assigned: claude-code
generated: 2026-04-09
---

## Scope
- [ ] Phase 1 — data-utils: backfill `publishedAt` on all existing seeded posts
- [ ] Phase 2 — Angular service: sync Post interface and RemoteApi with new
      model fields (`slug`, `publishedAt`, `readTime`, `hashtags[]`)
- [ ] Phase 3 — UI: home card truncation, quick view description limit,
      dynamic fields, multi-hashtag display rules, focus mode image carousel

## Role
Phase 1: Node/MongoDB script author — standalone script, no framework.
Phase 2-3: Angular frontend engineer — follow existing service and
component patterns. Read every referenced file before editing.

## Context

### New Post model fields now returned by Node API
```typescript
slug:        string        // url-friendly identifier
publishedAt: string | Date // ISO date, set on publish
readTime:    number        // minutes, integer >= 1
hashtags:    string[]      // array, lowercase
createdAt:   string | Date // immutable creation timestamp
```

### Current Angular Post interface (approximate — read actual file)
Lives in `ng-frontend/src/app/core/remote-api.service.ts`.
Add new fields — do not remove or rename existing ones.

### publishedAt feed query issue
Seeded posts have no `publishedAt` value. The Node feed query has
`publishedAt: { $ne: null }` commented out. Phase 1 fixes the data
so the query can be safely re-enabled in a follow-up task.

### Description display rules
| Surface | Rule | Implementation |
|---|---|---|
| Home card | CSS line-clamp: 3 | No JS, no substring |
| Quick view content | 100 words max | Angular pipe or computed |
| Focus mode | Full text | No truncation |

### Hashtag display rules
| Surface | Rule |
|---|---|
| Home card footer | Max 2 tags, `+N` pill if more |
| Quick view rail row | Max 1 tag |
| Focus mode header | All tags |

### Image carousel (focus mode)
Post `images[]` is an array of URLs. If `images.length > 1`, render a
CSS scroll-snap horizontal carousel — no external library.
If `images.length === 1`, render the existing single image layout unchanged.
If `images.length === 0`, render no image block.

---

## Task

### Phase 1 — Backfill publishedAt (data-utils script)

Create `data-utils/backfill-published-at.js` as a standalone Node script.
It must run independently — no imports from other monorepo packages.

```javascript
// data-utils/backfill-published-at.js
// Usage: node backfill-published-at.js
// Requires: MONGO_URI in environment (run via doppler or .env)

const { MongoClient } = require('mongodb');

async function backfill() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();
  const posts = db.collection('posts');

  // Find all posts with missing publishedAt
  const cursor = posts.find({
    isPublic: true,
    publishedAt: { $in: [null, undefined] },
    $or: [{ publishedAt: { $exists: false } }]
  });

  let count = 0;
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for await (const post of cursor) {
    // Random date between 6 months ago and now
    const randomMs = sixMonthsAgo.getTime() +
      Math.random() * (now.getTime() - sixMonthsAgo.getTime());
    const publishedAt = new Date(randomMs);

    await posts.updateOne(
      { _id: post._id },
      { $set: { publishedAt } }
    );
    count++;
  }

  console.log(`Backfilled publishedAt for ${count} posts.`);
  await client.close();
}

backfill().catch(console.error);
```

Run with:
```bash
cd data-utils && doppler run -- node backfill-published-at.js
```

Verify: check 3–5 posts in MongoDB Atlas — all should now have
`publishedAt` as a Date value.

Done when: zero posts in the collection have `publishedAt: null` or missing.

---

### Phase 2 — Angular Post interface + RemoteApi

#### Step 1 — Read first
- `ng-frontend/src/app/core/remote-api.service.ts`
- `ng-frontend/src/app/features/home/home.component.ts`
- `ng-frontend/src/app/features/quick-view/quick-view-content.component.ts`
- `ng-frontend/src/app/features/post-detail/post-detail.ts`

#### Step 2 — Update Post interface
Add new fields to the existing `Post` interface:

```typescript
export interface Post {
  // existing fields — do not change
  uuid:         string;
  title:        string;
  description:  string;
  authorName:   string;
  authorAvatar?: string;
  images:       string[];
  hashtags:     string[];
  isPublic:     boolean;
  isDraft:      boolean;
  lastEditedAt?: string;
  views:        number;
  // new fields
  slug?:        string;
  publishedAt?: string | Date;
  readTime?:    number;
  createdAt?:   string | Date;
}
```

All new fields are optional (`?`) — existing components will not break
if the API returns posts without them during transition.

#### Step 3 — Add truncation pipe

Create `ng-frontend/src/app/shared/pipes/truncate-words.pipe.ts`:

```typescript
@Pipe({ name: 'truncateWords', standalone: true, pure: true })
export class TruncateWordsPipe implements PipeTransform {
  transform(value: string, maxWords: number): string {
    if (!value) return '';
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return value;
    return words.slice(0, maxWords).join(' ') + '…';
  }
}
```

#### Step 4 — Add hashtag slice pipe

Create `ng-frontend/src/app/shared/pipes/hashtag-slice.pipe.ts`:

```typescript
@Pipe({ name: 'hashtagSlice', standalone: true, pure: true })
export class HashtagSlicePipe implements PipeTransform {
  transform(tags: string[], max: number): { visible: string[]; overflow: number } {
    if (!tags?.length) return { visible: [], overflow: 0 };
    return {
      visible: tags.slice(0, max),
      overflow: Math.max(0, tags.length - max)
    };
  }
}
```

---

### Phase 3 — UI updates

Read each component file before editing. Apply only the changes
described below — do not refactor unrelated code.

#### Step 1 — Home card (`post-card.component`)

**Description truncation** — replace any existing substring/truncation
logic with CSS only. In `post-card.component.scss`:

```scss
.card-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  // remove any existing max-height or text-overflow rules on this element
}
```

**Hashtag display** — in `post-card.component.html`, use the
`hashtagSlice` pipe (max 2):

```html
@let tagResult = post.hashtags | hashtagSlice:2;
@for (tag of tagResult.visible; track tag) {
  <span class="post-tag">#{{ tag }}</span>
}
@if (tagResult.overflow > 0) {
  <span class="post-tag-overflow">+{{ tagResult.overflow }}</span>
}
```

**Author and publishedAt** — if not already displayed, add to card footer:
```html
<span class="card-meta">{{ post.authorName }}</span>
@if (post.publishedAt) {
  <span class="card-meta">{{ post.publishedAt | date:'MMM yyyy' }}</span>
}
```

#### Step 2 — Quick view content (`quick-view-content.component`)

**Description truncation** — apply the `truncateWords` pipe (100 words):
```html
<p class="post-excerpt">{{ post.description | truncateWords:100 }}</p>
```

**Dynamic fields** — ensure these are bound and display only when present:
```html
@if (post.publishedAt) {
  <span>{{ post.publishedAt | date:'MMM d, yyyy' }}</span>
}
@if (post.readTime) {
  <span>{{ post.readTime }} min read</span>
}
```

#### Step 3 — Quick view rail (`quick-view-rail.component`)

**Hashtag** — show max 1 tag per rail row:
```html
@if (post.hashtags?.length) {
  <span class="post-tag">#{{ post.hashtags[0] }}</span>
}
```

#### Step 4 — Focus mode (`post-detail.component`)

**All hashtags**:
```html
@for (tag of post.hashtags; track tag) {
  <span class="post-tag">#{{ tag }}</span>
}
```

**publishedAt and readTime**:
```html
@if (post.publishedAt) {
  <span>{{ post.publishedAt | date:'MMMM d, yyyy' }}</span>
}
@if (post.readTime) {
  <span>{{ post.readTime }} min read</span>
}
```

**Image carousel** — replace the single image block with:
```html
@if (post.images?.length) {
  @if (post.images.length === 1) {
    <img [src]="post.images[0]" class="post-image-single" [alt]="post.title">
  } @else {
    <div class="image-carousel">
      @for (img of post.images; track img) {
        <img [src]="img" class="carousel-slide" [alt]="post.title">
      }
    </div>
  }
}
```

In `post-detail.component.scss`:
```scss
.image-carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  gap: 8px;
  border-radius: 12px;
  -webkit-overflow-scrolling: touch;

  // hide scrollbar visually, keep functional
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.carousel-slide {
  scroll-snap-align: start;
  flex-shrink: 0;
  width: 100%;
  height: 320px;
  object-fit: cover;
  border-radius: 12px;
}
```

---

## Constraints
- Phase 1 script must be standalone — no imports from `node-backend`
  or `ng-frontend`
- Phase 1 script must use `doppler run --` for env injection — no
  hardcoded connection strings
- New Angular pipes must be `standalone: true` and `pure: true`
- Do not add external carousel libraries — CSS scroll-snap only
- Do not remove or rename any existing Post interface fields
- CSS line-clamp is the only acceptable truncation method for home cards —
  no substring, no Angular pipes on description in home card
- `ng build --prod` must pass with zero errors after Phase 2 and Phase 3

## Expected Output

Phase 1:
1. `data-utils/backfill-published-at.js` — backfill script

Phase 2:
2. `ng-frontend/src/app/core/remote-api.service.ts` — Post interface updated
3. `ng-frontend/src/app/shared/pipes/truncate-words.pipe.ts` — new pipe
4. `ng-frontend/src/app/shared/pipes/hashtag-slice.pipe.ts` — new pipe

Phase 3:
5. `ng-frontend/src/app/shared/ui/post-card/post-card.component.html`
   — CSS truncation, hashtag slice, publishedAt
6. `ng-frontend/src/app/shared/ui/post-card/post-card.component.scss`
   — line-clamp rule
7. `ng-frontend/src/app/features/quick-view/quick-view-content.component.html`
   — truncateWords pipe, dynamic fields
8. `ng-frontend/src/app/features/quick-view/quick-view-rail.component.html`
   — single hashtag
9. `ng-frontend/src/app/features/post-detail/post-detail.component.html`
   — all hashtags, carousel, dynamic fields
10. `ng-frontend/src/app/features/post-detail/post-detail.component.scss`
    — carousel styles

## Evaluation Checklist

Phase 1:
- [ ] Script runs without error via `doppler run -- node backfill-published-at.js`
- [ ] MongoDB Atlas shows `publishedAt` populated on all seeded posts
- [ ] No posts remain with `publishedAt: null` or missing field

Phase 2:
- [ ] Post interface compiles with new optional fields
- [ ] `ng build --prod` passes with zero errors

Phase 3:
- [ ] Home cards: description never overflows — 3 lines max, word boundary respected
- [ ] Home cards: max 2 hashtags shown, `+N` pill visible when more exist
- [ ] Quick view content: description limited to 100 words with `…`
- [ ] Quick view content: `publishedAt` and `readTime` display when present
- [ ] Quick view rail: only first hashtag shown per row
- [ ] Focus mode: all hashtags displayed
- [ ] Focus mode: single image renders as before
- [ ] Focus mode: multiple images render as horizontal scroll carousel
- [ ] Carousel scrolls smoothly, no scrollbar visible, snap works
- [ ] `ng build --prod` passes with zero errors

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: