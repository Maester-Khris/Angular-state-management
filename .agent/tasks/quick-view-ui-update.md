# Task: Quick View — Rail Polish & Mobile Responsive Layout

## Scope
- [ ] Rail: width 260px, rename title, add author + read time per row,
      pagination controls at bottom, post count label
- [ ] Rail: keyboard navigation ↑↓ / J/K, → opens focus read,
      Esc closes (already present — verify), scroll-to-active on keyboard nav
- [ ] Content: add read time to header, slide direction tied to nav direction,
      empty queue fallback state
- [ ] Mobile (≤600px): content-first layout, rail hidden, "Up next"
      numbered list below content, swipe left/right gesture for navigation

## Role
Angular frontend engineer. Pure UI/CSS/TS work within the existing
`quick-view` feature folder. No new routes, no new services, no HTTP calls.
Read all three quick-view component files before writing anything.

## Context

### Current state after Phase 1+2+3
Three components exist and render:
- `QuickViewContainerComponent` — orchestrator, router, SessionQueueService
- `QuickViewRailComponent` — left session list, progress dots
- `QuickViewContentComponent` — right content panel

### Design targets
Rail: 260px wide · "Your reading session" title · each row shows tag +
title + author + read time · progress dots + "N of M" count label ·
prev/next batch pagination at bottom · keyboard hint row (↑↓ navigate · → read · Esc close)

Content: tag · title · author + date + read time · image · excerpt ·
"Read full post →" · slide direction matches navigation direction

Mobile ≤600px: full-width content panel · "Up next" section below
(numbered rows, 3 visible, scrollable) · swipe gesture · no rail

### Keyboard contract
| Key | Action |
|-----|--------|
| ↑ or K | previous post in rail |
| ↓ or J | next post in rail |
| → | read full post (navigate to /post/:uuid) |
| Esc | close overlay (already implemented — verify not broken) |

scrollIntoView({ behavior: 'smooth', block: 'nearest' }) on active rail item
after every keyboard navigation.

## Task

### 1. Read before editing
- `quick-view-rail.component.ts` + `.html` + `.scss`
- `quick-view-content.component.ts` + `.html` + `.scss`
- `quick-view-container.component.ts` + `.html` + `.scss`

### 2. Phase 1 — Rail & keyboard (web)

**Rail component changes:**

Title: change "IN THIS SESSION" → "YOUR READING SESSION"

Rail width: update container SCSS from current width to 260px

Each rail row add below title:
```html
<span class="rail-item-meta">
  {{ item.authorName }} · {{ item.readTime }} min
</span>
```

Below progress dots add count label:
```html
<span class="rail-count">{{ activeIndex() + 1 }} of {{ queue().length }}</span>
```

At rail bottom add pagination row:
```html
<div class="rail-pagination">
  <button (click)="onPrev()" [disabled]="activeIndex() === 0">↑ prev</button>
  <button (click)="onNext()" [disabled]="activeIndex() === queue().length - 1">↓ next</button>
</div>
```

At rail bottom add keyboard hint row:
```html
<div class="rail-kbd-hints">
  <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
  <span><kbd>→</kbd> read</span>
  <span><kbd>Esc</kbd> close</span>
</div>
```

**Container: keyboard handler**

Add `@HostListener('window:keydown', ['$event'])` in container:
```typescript
@HostListener('window:keydown', ['$event'])
onKeydown(e: KeyboardEvent): void {
  switch(e.key) {
    case 'ArrowUp':
    case 'k':
      e.preventDefault();
      this.navigatePrev();
      break;
    case 'ArrowDown':
    case 'j':
      e.preventDefault();
      this.navigateNext();
      break;
    case 'ArrowRight':
      if (this.currentPost()) this.onReadFull(this.currentPost()!.uuid);
      break;
  }
}
```

After navigateTo(), call scrollActiveIntoView():
```typescript
scrollActiveIntoView(): void {
  const activeEl = document.querySelector('.rail-item.active');
  activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
```

**Content: slide direction**

In container, track direction signal:
```typescript
slideDir = signal<'left' | 'right' | 'none'>('none');

navigateNext(): void {
  this.slideDir.set('left');
  this.queue.navigateTo(this.activeIndex() + 1);
  this.scrollActiveIntoView();
}
navigatePrev(): void {
  this.slideDir.set('right');
  this.queue.navigateTo(this.activeIndex() - 1);
  this.scrollActiveIntoView();
}
```

Pass `[slideDir]="slideDir()"` to `QuickViewContentComponent`.
In content SCSS:
```scss
.content-panel {
  transition: transform 0.2s ease, opacity 0.2s ease;
  &.slide-left  { animation: slideLeft  0.2s ease; }
  &.slide-right { animation: slideRight 0.2s ease; }
}
@keyframes slideLeft  { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes slideRight { from { transform: translateX(-24px); opacity: 0; } to { transform: none; opacity: 1; } }
```

**Empty queue fallback**

In container `ngOnInit`, if uuid from route not found in queue:
```typescript
if (this.queue.queue().length === 0) {
  // show fallback — do not crash
  this.showEmptyFallback.set(true);
}
```

In container template:
```html
@if (showEmptyFallback()) {
  <div class="empty-fallback">
    <p>No reading session active.</p>
    <a routerLink="/home">Back to feed</a>
  </div>
}
```

### 3. Phase 2 — Mobile responsive (≤600px)

In container SCSS:
```scss
@media (max-width: 600px) {
  .quick-view-layout {
    flex-direction: column;
  }
  .quick-view-rail {
    display: none; // hidden on mobile
  }
  .quick-view-content {
    width: 100%;
    border-left: none;
  }
}
```

In content component, add "Up next" section visible only on mobile:
```html
@if (isMobile()) {
  <section class="up-next">
    <h3 class="up-next-label">Up next</h3>
    @for (post of upNextPosts(); track post.uuid; let i = $index) {
      <div class="up-next-item" (click)="onUpNextClick(i)">
        <span class="up-next-num">{{ (i + 1).toString().padStart(2, '0') }}</span>
        <div class="up-next-info">
          <span class="up-next-title">{{ post.title }}</span>
          <span class="up-next-meta">{{ post.category }} · {{ post.readTime }} min</span>
        </div>
        <span class="up-next-arrow">›</span>
      </div>
    }
  </section>
}
```

`isMobile()` is a signal computed from `inject(BreakpointObserver)` or a simple
`window.innerWidth` check wrapped in a signal — use whichever pattern exists in
the codebase already. Do not add `@angular/cdk` if not already a dependency.

`upNextPosts()` = next 3 posts from the queue after current index.

Swipe gesture: in content component `ngAfterViewInit`, attach touch handlers
to the content panel element:
```typescript
private startX = 0;
onTouchStart(e: TouchEvent) { this.startX = e.touches[0].clientX; }
onTouchEnd(e: TouchEvent) {
  const delta = e.changedTouches[0].clientX - this.startX;
  if (Math.abs(delta) > 50) {
    delta < 0 ? this.next.emit() : this.prev.emit();
  }
}
```

Emit `@Output() next` and `@Output() prev` from content, handle in container.

## Constraints
- Do not add new npm packages unless `@angular/cdk` is already in package.json
- Do not change `SessionQueueService` — it is complete
- Do not change `app.routes.ts` — routing is complete
- Do not change `HomeComponent` — it is complete after Phase 3
- SCSS must use existing platform CSS variables — no new color values
- `ng build --prod` must pass with zero errors after each phase
- Mobile breakpoint is 600px — match existing breakpoints in the codebase
  if they differ (read global SCSS before hardcoding 600px)

## Expected Output
Phase 1:
1. `quick-view-rail.component.html` — title, author+time rows, count, pagination, kbd hints
2. `quick-view-rail.component.scss` — 260px width, row meta styles, pagination, kbd styles
3. `quick-view-content.component.ts` — slideDir input, animation class binding
4. `quick-view-content.component.scss` — slide animations
5. `quick-view-container.component.ts` — keyboard handler, slideDir signal,
   navigateNext/Prev, scrollActiveIntoView, empty fallback signal
6. `quick-view-container.component.html` — empty fallback block

Phase 2:
7. `quick-view-container.component.scss` — mobile breakpoint, rail hidden
8. `quick-view-content.component.html` — "Up next" section, touch handlers
9. `quick-view-content.component.ts` — isMobile signal, upNextPosts computed,
   touch start/end handlers, next/prev outputs

## Evaluation Checklist
Phase 1:
- [ ] Rail is 260px wide — measure in devtools
- [ ] Each rail row shows author and read time below title
- [ ] "Your reading session" label renders
- [ ] "N of M" count label visible below dots
- [ ] Prev/next buttons at rail bottom, disabled at boundaries
- [ ] ↑↓ J/K keyboard nav changes active post
- [ ] → keyboard opens focus read at /post/:uuid
- [ ] Active rail item scrolls into view on keyboard nav
- [ ] Slide direction is left when going forward, right when going back
- [ ] Empty queue shows fallback with back-to-feed link
- [ ] ng build passes

Phase 2:
- [ ] At ≤600px: rail is hidden, content is full width
- [ ] "Up next" section shows 3 numbered posts below content on mobile
- [ ] Tapping an "Up next" item navigates to that post in the session
- [ ] Swipe left → next post, swipe right → previous post
- [ ] No layout overflow at 375px (iPhone SE width)
- [ ] ng build passes

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: