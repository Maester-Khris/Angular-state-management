# Task: Refactor Home Layout to Google-Style Two-Column Rail

## Scope
- [ ] Restructure `home.component.html` outer layout: searchbar centered full-width, post grid below it, AI rail appears beside the grid only when active
- [ ] Post grid transitions from 100% width (no AI) to ~60% width (AI active) using CSS only — no JS width calculation
- [ ] AI rail is fixed width, never shrinks or grows regardless of content
- [ ] AI panel loading state ("AI is analysing your query") renders at fixed height — no layout jump
- [ ] AI panel with no results stays within its fixed-width block — no overflow, no stretch
- [ ] All three states render correctly: no-AI (full grid), AI+results, AI+no-results
- [ ] No changes to `home.component.ts` business logic or streams
- [ ] No changes to `ai-results-panel` internal template or styles beyond the loading placeholder height fix

## Role
Angular layout engineer. You are restructuring the CSS/SCSS and HTML shell of an existing component. Do not touch RxJS streams, data-fetching logic, or child component internals. Read every file before editing.

## Context

### Current DOM structure (provided)
```html
<app-hero></app-hero>

<div #communityGrid class="home-container px-3 px-md-4" *ngIf="vm$ | async as vm">
  <header class="home-header mb-5">
    <app-search-bar (search)="onSearch($event)" [isAiActive]="isAiActive()">
    </app-search-bar>
  </header>

  <div class="home-content-layout d-flex flex-column flex-lg-row gap-4" *ngIf="vm.isAvailable">
    <div class="bento-grid-container flex-grow-1">
      <div class="bento-grid" id="community-post">
        <!-- post cards + skeletons -->
      </div>
    </div>
    <app-ai-results-panel [aiState]="(aiResults$ | async) ?? { state: 'idle' }"
                          (docSelected)="openDetails($event)">
    </app-ai-results-panel>
  </div>

  <app-empty-state ...></app-empty-state>
  <div class="status-footer ...">...</div>
  <div class="immersive-overlay ...">...</div>
</div>

<app-footer></app-footer>
```

### Problems to fix
| Problem | Root cause |
|---|---|
| Grid compresses when AI panel present | `flex-grow-1` on grid + auto-width panel share the same flex row equally |
| Panel stretches when no results | `app-ai-results-panel` always occupies flex space even when idle |
| Loading state causes height jump | Panel height is `auto`, jumps from 0 to text height |
| No-result AI block overflows | Panel has no fixed width constraint in the current flex context |

### Target layout model
```
home-container
└── home-header          ← searchbar, full width, centered
└── home-body-row        ← flex row, align-items: flex-start
    ├── home-post-area   ← flex: 1 1 0, min-width: 0
    │   ├── bento-grid
    │   ├── empty-state
    │   └── status-footer
    └── home-ai-rail     ← 320px fixed, flex-shrink: 0
                            only rendered when AI state !== idle
                            position: sticky, top: navbar height
```

The key mechanic: `home-post-area` uses `flex: 1 1 0` (not `flex-grow-1`), which means it
takes all available space and **gives back exactly 320px** when the rail is present —
no `calc()`, no JS, no explicit percentage. The grid always fills whatever its parent gives it.

### Why not `60%`
A hard `60%` breaks at edge widths. The flex model achieves the same visual result at any
viewport width while staying responsive: grid fills all space minus the fixed rail.

---

## Task

### 1. Read before editing
Read these files in full before making any change:
- `home.component.html` — confirmed above, verify nothing was omitted
- `home.component.scss` — find current `.home-content-layout`, `.bento-grid-container`,
  any width overrides on the panel, and `.home-container` rules

### 2. `home.component.html` — target structure

Replace the `div.home-content-layout` block and everything inside it with the structure
below. Preserve all existing bindings, directives, and refs exactly as they are today.
```html
<app-hero></app-hero>

<div #communityGrid class="home-container px-3 px-md-4" *ngIf="vm$ | async as vm"
     style="margin-top: 40px!important;">

  <!-- Searchbar: full width, centered -->
  <header class="home-header mb-5">
    <app-search-bar (search)="onSearch($event)" [isAiActive]="isAiActive()">
    </app-search-bar>
  </header>

  <!-- Body row: grid + conditional AI rail -->
  <div class="home-body-row" *ngIf="vm.isAvailable">

    <!-- Post area: flex: 1, always fills remaining space -->
    <div class="home-post-area">
      <div class="bento-grid" id="community-post">
        @for (post of vm.posts; track post.uuid; let i = $index) {
          <div class="bento-item"
               (click)="openDetails(post.uuid!)"
               [attr.data-post-id]="post.uuid"
               [trackPreview]="post.uuid!">
            <app-post-card [post]="post" mode="card">
              <div actions>
                <button class="btn-fav ms-auto">
                  <i class="bi bi-bookmark-plus"></i>
                </button>
              </div>
            </app-post-card>
          </div>
        }
        @if (vm.loading) {
          @for (i of [1, 2, 3]; track i) {
            <div class="bento-item">
              <app-skeleton-card></app-skeleton-card>
            </div>
          }
        }
      </div>

      <app-empty-state
        [isAvailable]="vm.isAvailable"
        [hasNoPosts]="vm.posts.length === 0"
        [isLoading]="vm.loading"
        (retry)="ngOnInit()">
      </app-empty-state>

      <div class="status-footer py-5 text-center">
        @if (vm.loading) {
          <app-loading-spinner size="sm" label="Fetching more insights...">
          </app-loading-spinner>
        }
        @if (vm.hasMore) {
          <div appInfiniteScroll (scrolled)="loadMore(vm.loading)"
               class="scroll-anchor"></div>
        } @else if (vm.posts.length > 0) {
          <div class="no-more-indicator">
            <hr class="w-25 mx-auto opacity-10">
            <p class="text-muted small fw-medium">No more posts at this time.</p>
          </div>
        }
      </div>
    </div>

    <!-- AI rail: fixed width, only mounts when AI state is not idle -->
    @if ((aiResults$ | async)?.state !== 'idle') {
      <aside class="home-ai-rail">
        <app-ai-results-panel
          [aiState]="(aiResults$ | async) ?? { state: 'idle' }"
          (docSelected)="openDetails($event)">
        </app-ai-results-panel>
      </aside>
    }

  </div>

  <!-- Immersive drawer: unchanged, outside the body row -->
  <div class="immersive-overlay" [class.active]="isDrawerOpen()"
       (click)="closeDetails()">
    <div class="detail-container" (click)="$event.stopPropagation()">
      <router-outlet></router-outlet>
    </div>
  </div>

</div>

<app-footer></app-footer>
```

**What moved:**
- `app-empty-state` moved inside `home-post-area` (it belongs to the post area, not the rail)
- `status-footer` moved inside `home-post-area` (infinite scroll anchor must stay with the grid)
- `immersive-overlay` stays outside `home-body-row` (it is a full-viewport overlay)
- `#communityGrid` ViewChild ref stays on `div.home-container` — do not move it

### 3. `home.component.scss` — layout rules

#### 3a. Remove these old rules (find by class name, delete entirely)
- `.home-content-layout` — replaced by `.home-body-row`
- `.bento-grid-container` — wrapper div removed, `.bento-grid` is now a direct child of `.home-post-area`
- Any `flex-grow-1` override applied to the grid container specifically
- Any explicit `width` or `max-width` set on the AI panel from the home stylesheet

#### 3b. Add these new rules
```scss
// ─── Body row: grid + rail side by side ─────────────────────────────────────
.home-body-row {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

// Post area: takes all space the rail does not claim
// flex: 1 1 0 (not flex-grow-1) ensures it gives back exactly 320px to the rail
.home-post-area {
  flex: 1 1 0;
  min-width: 0; // prevents flex blowout on long post titles
}

// AI rail: fixed 320px, never shrinks, sticks while scrolling
// --navbar-height should match the actual app navbar height (default 72px)
.home-ai-rail {
  $rail-width: 320px;
  $navbar-height: 72px; // ← update this if the navbar height changes

  width: $rail-width;
  flex-shrink: 0;
  position: sticky;
  top: $navbar-height + 16px;
  align-self: flex-start; // prevents stretching to match post-area height
  max-height: calc(100vh - #{$navbar-height} - 32px);
  overflow-y: auto;
}

// ─── Responsive: stack below 900px ──────────────────────────────────────────
@media (max-width: 900px) {
  .home-body-row {
    flex-direction: column;
  }

  .home-ai-rail {
    width: 100%;
    position: static;
    max-height: none;
    overflow-y: visible;
  }
}
```

### 4. `ai-results-panel` loading state height fix

The loading placeholder ("AI is analysing your query…") causes a layout jump because the
panel transitions from 0 height to content height. Fix this inside
`ai-results-panel.component.scss` — do not change the template:
```scss
// Loading state: reserve fixed height so the rail width does not cause a reflow
// when the response arrives and content fills in
.ai-results-panel {
  min-height: 0; // collapses when idle (state guard in home prevents render)

  &--loading {
    // Reserve enough height for ~5 results so the rail does not jump
    // Use min-height not height so longer results are not clipped
    min-height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

In `ai-results-panel.component.html`, ensure the loading block has the BEM modifier class:
```html
@if (aiState.state === 'loading') {
  <div class="ai-results-panel__loading ai-results-panel--loading">
    <p class="text-muted small">AI is analysing your query…</p>
  </div>
}
```

---

## Constraints
- Do not touch `home.component.ts`
- Do not touch `ai-results-panel` internal template except the loading block class above
- Do not touch `post-card`, `search-bar`, `app-empty-state`, or `app-skeleton-card`
- Do not use `calc(60%)` or any percentage width on `.home-post-area` — flex handles it
- Do not use inline `[style]` bindings for layout widths
- `#communityGrid` ViewChild must remain on `div.home-container`
- `appInfiniteScroll` directive must remain on its current element inside the post area
- The `immersive-overlay` must stay outside `home-body-row`
- SCSS `$navbar-height` variable must be a named variable with a comment — not a magic number
- `ng build --prod` must produce zero new errors or warnings

---

## Expected Output
1. `home.component.html` — restructured as shown, all bindings preserved
2. `home.component.scss` — old competing layout rules removed, new flex rail rules added
3. `ai-results-panel.component.scss` — loading state min-height added
4. `ai-results-panel.component.html` — loading block gets BEM modifier class (one-line change)

---

## Evaluation Checklist
- [ ] AI off: grid fills 100% of `home-body-row` — confirmed in Chrome devtools, no gap on right
- [ ] AI on + posts: grid fills `100% - 320px - 24px gap`, rail exactly 320px
- [ ] AI on + no posts: empty state renders in left area, rail still 320px on right, no overflow
- [ ] Loading state: rail renders at 280px min-height immediately — no jump when results arrive
- [ ] Rail does not appear as empty box when `aiResults$` state is `idle`
- [ ] Rail is sticky: scrolling a long post list keeps the rail in the viewport
- [ ] At ≤900px: rail stacks below the grid, full width, no sticky
- [ ] Infinite scroll still triggers (`appInfiniteScroll` intact inside post area)
- [ ] Drawer overlay still works (`immersive-overlay` outside body row)
- [ ] `ng build --prod` zero errors

---

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: