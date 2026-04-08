---
status: in-progress   # pending | in-progress | blocked | done
assigned: claude-code
started: 2026-04-04
---

# Task: Quick View — Card Button + Overlay Integration

## Scope
- [ ] ng-frontend service only 
  - [ ] Add quick-view eye icon button to `PostCardComponent` with click handler
  - [ ] Create `QuickViewContainerComponent` in `src/app/features/quick-view/`
  - [ ] Create `QuickViewContentComponent` as the injectable content panel
  - [ ] Create `QuickViewRailComponent` as the left session rail
  - [ ] Register `quick-view/:uuid` as a child route of `home` matching the existing `view/:uuid` pattern
  - [ ] Wire home navigation to open the quick-view overlay on eye icon click
  - [ ] `SessionQueueService` to hold in-memory post queue (Signal-based, capped at 30)

## Role
Angular frontend engineer. You are adding a new feature overlay that mirrors the
architectural pattern of the existing `view/:uuid` child route and `PostDetail`
component. Read every referenced file before writing any code. Follow existing
naming conventions, file structure, and import patterns exactly.

## Context

### Existing navigation pattern to mirror
The current focus read flow uses a child route under `home`:
```typescript
{
  path: "home",
  loadComponent: () => import("./features/home/home").then(c => c.Home),
  resolve: { initialPosts: HomeResolver },
  children: [
    {
      path: "view/:uuid",
      loadComponent: () =>
        import("./features/post-detail/post-detail").then(c => c.PostDetail)
    }
  ]
}
```

`HomeComponent` renders a `div.immersive-overlay` that hosts `<router-outlet>`.
When the child route activates, the overlay becomes visible via `[class.active]`.
Quick view must follow the **exact same pattern** — a second child route, a second
outlet or the same outlet with a different component. Read `home.component.html`
and `home.component.ts` to understand how `isDrawerOpen()` and the overlay work
before deciding which approach fits cleanest.

### UI design reference
From previous design sessions:
```
QuickViewContainer (overlay, full-screen)
├── QuickViewRail (left · 200px fixed · session list)
│   ├── "In this session" label
│   ├── progress dots (activeIndex)
│   └── PostRow × N (title, tag, read time)
└── QuickViewContent (flex: 1 · post preview)
    ├── category tag
    ├── title
    ├── author + date + read time
    ├── cover image (already in browser cache from home card)
    ├── description excerpt (already in memory — no new fetch)
    └── "Read full post →" CTA (navigates to focus read)
```

### Data — zero new HTTP requests on open
The card payload fetched by home already contains everything quick view needs:
`uuid`, `title`, `description`, `authorName`, `category`, `coverImageUrl`.
Quick view must not fire any HTTP request when opening or navigating between
posts in the session. All data comes from `SessionQueueService`.

### SessionQueueService — the source of truth
A plain Angular service (no NgRx) using Signals:
```typescript
// Capped at 30. Evicts from head when cap exceeded.
// activeIndex is a pointer — never destructive pop.
readonly queue  = signal<Post[]>([]);
readonly activeIndex = signal<number>(0);
readonly currentPost = computed(() =>
  this.queue()[this.activeIndex()] ?? null
);
```

Home populates the queue when the user clicks the eye icon. The queue persists
for the lifetime of the browser session (not persisted to storage).

### Component decomposition
Three components, one service:

| Component | Responsibility |
|---|---|
| `QuickViewContainerComponent` | Overlay shell, flex row, hosts rail + content, reads router param to set activeIndex |
| `QuickViewRailComponent` | Left 200px rail, session list, active highlight, progress dots |
| `QuickViewContentComponent` | Right content panel, renders currentPost signal, slide transition |

The rail and content are `@Input`-driven children of the container.
The container is the only component that touches the router or the service directly.

---

## Task

### 1. Read before writing
Read these files in full before making any change:

- `src/app/app.routes.ts` — understand the full route tree
- `src/app/features/home/home.component.ts` — find `isDrawerOpen()`, overlay
  logic, `openDetails()`, `closeDetails()`, `router.navigate` calls
- `src/app/features/home/home.component.html` — find `div.immersive-overlay`,
  `<router-outlet>`, the `[class.active]` binding
- `src/app/features/post-card/post-card.component.ts` and `.html` — find the
  existing bookmark button to place the eye icon beside it
- `src/app/core/remote-api.service.ts` — find the `Post` interface definition

### 2. `SessionQueueService`

Create `src/app/core/session-queue.service.ts`:
```typescript
@Injectable({ providedIn: 'root' })
export class SessionQueueService {
  private readonly CAP = 30;

  readonly queue        = signal<Post[]>([]);
  readonly activeIndex  = signal<number>(0);
  readonly currentPost  = computed(() =>
    this.queue()[this.activeIndex()] ?? null
  );

  // Called by home when eye icon is clicked.
  // Finds the clicked post's index if already in queue,
  // otherwise resets queue to the current home batch
  // and sets activeIndex to the clicked post.
  openSession(clickedPost: Post, homeBatch: Post[]): void {
    const existingIdx = this.queue().findIndex(p => p.uuid === clickedPost.uuid);
    if (existingIdx !== -1) {
      this.activeIndex.set(existingIdx);
      return;
    }
    this.queue.set(homeBatch.slice(0, this.CAP));
    const idx = homeBatch.findIndex(p => p.uuid === clickedPost.uuid);
    this.activeIndex.set(Math.max(0, idx));
  }

  // Append more posts from a new home batch (infinite scroll integration).
  // Called by home when prefetch threshold is reached.
  enqueue(posts: Post[]): void {
    this.queue.update(q => {
      const merged = [...q, ...posts];
      return merged.length > this.CAP
        ? merged.slice(merged.length - this.CAP)
        : merged;
    });
  }

  navigateTo(index: number): void {
    if (index >= 0 && index < this.queue().length) {
      this.activeIndex.set(index);
    }
  }

  clear(): void {
    this.queue.set([]);
    this.activeIndex.set(0);
  }
}
```

### 3. `PostCardComponent` — add eye icon button

In `post-card.component.html`, locate the bookmark button in the card footer.
Add the eye icon button immediately to its left:
```html
<!-- Quick view button — placed left of the existing bookmark button -->
<button
  class="btn-quick-view"
  title="Quick view"
  (click)="onQuickView($event)">
  <i class="bi bi-eye"></i>
</button>
```

In `post-card.component.ts`, add the output and handler:
```typescript
@Output() quickView = new EventEmitter<void>();

onQuickView(event: MouseEvent): void {
  event.stopPropagation(); // prevent card body click triggering focus read
  this.quickView.emit();
}
```

In `post-card.component.scss`, style the button to match the existing bookmark
button style — same size, same border, blue tint to differentiate:
```scss
.btn-quick-view {
  // Mirror .btn-fav sizing and border exactly — read existing styles first
  // Add: color: var(--bs-primary) or equivalent platform accent variable
  // No new sizing values — copy from .btn-fav and only override color
}
```

### 4. Feature folder structure

Create the following files:
```
src/app/features/quick-view/
  quick-view-container.component.ts
  quick-view-container.component.html
  quick-view-container.component.scss
  quick-view-rail.component.ts
  quick-view-rail.component.html
  quick-view-rail.component.scss
  quick-view-content.component.ts
  quick-view-content.component.html
  quick-view-content.component.scss
  index.ts
```

### 5. `QuickViewRailComponent`

Accepts the queue and activeIndex as inputs. Emits navigation events upward.
Does not touch the router or service directly.
```typescript
@Component({
  selector: 'app-quick-view-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class QuickViewRailComponent {
  @Input({ required: true }) queue:       Post[]  = [];
  @Input({ required: true }) activeIndex: number  = 0;
  @Output() navigate = new EventEmitter<number>();
}
```

Template: "In this session" label, progress dots row (active dot is wider pill),
list of post rows (tag, title, read-time). Active row has highlighted border.
Clicking any row emits `navigate(index)`.

### 6. `QuickViewContentComponent`

Receives a single post as input. Renders the preview. Emits `readFull` when
the CTA is clicked.
```typescript
@Component({
  selector: 'app-quick-view-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class QuickViewContentComponent {
  @Input({ required: true }) post!: Post;
  @Output() readFull = new EventEmitter<string>(); // emits uuid
}
```

Template: category tag, title, author row (avatar initials + name + date +
read time), cover image, description, "Read full post →" button.

Apply a slide transition class on post change. Use `@Input` setter to detect
direction and set a `slideDirection` signal (`'left' | 'right' | null`) that
drives the CSS animation class:
```typescript
private previousUuid = '';

@Input({ required: true }) set post(value: Post) {
  // detect direction by queue index comparison is handled by container
  // container passes slideDir as a separate input
  this._post = value;
}
```

Keep it simple for the MVP — a single `@Input() slideDir: 'left'|'right'|'none'`
passed from the container. The CSS handles the animation.

### 7. `QuickViewContainerComponent`

The orchestrator. Reads `:uuid` from the route params, syncs with
`SessionQueueService`, wires rail and content together.
```typescript
@Component({
  selector: 'app-quick-view-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuickViewRailComponent, QuickViewContentComponent, CommonModule]
})
export class QuickViewContainerComponent implements OnInit {
  private route    = inject(ActivatedRoute);
  private router   = inject(Router);
  private queue    = inject(SessionQueueService);

  protected posts       = this.queue.queue;
  protected activeIndex = this.queue.activeIndex;
  protected currentPost = this.queue.currentPost;
  protected slideDir    = signal<'left'|'right'|'none'>('none');

  ngOnInit() {
    // Sync route param to activeIndex in case of direct URL load
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      const idx = this.queue.queue().findIndex(p => p.uuid === uuid);
      if (idx !== -1) this.queue.navigateTo(idx);
    }
  }

  onNavigate(index: number): void {
    const dir = index > this.activeIndex() ? 'left' : 'right';
    this.slideDir.set(dir);
    this.queue.navigateTo(index);
    // Update URL without full navigation — preserves overlay state
    this.router.navigate(['..', this.currentPost()?.uuid], {
      relativeTo: this.route,
      replaceUrl: true
    });
  }

  onReadFull(uuid: string): void {
    this.router.navigate(['/post', uuid]);
  }

  onClose(): void {
    this.router.navigate(['../..'], { relativeTo: this.route });
  }
}
```

### 8. Route registration

In `src/app/app.routes.ts`, add `quick-view/:uuid` as a second child of `home`,
parallel to the existing `view/:uuid`:
```typescript
{
  path: "home",
  loadComponent: () => import("./features/home/home").then(c => c.Home),
  resolve: { initialPosts: HomeResolver },
  children: [
    {
      path: "view/:uuid",
      loadComponent: () =>
        import("./features/post-detail/post-detail").then(c => c.PostDetail)
    },
    {
      path: "quick-view/:uuid",
      loadComponent: () =>
        import("./features/quick-view/quick-view-container.component")
          .then(c => c.QuickViewContainerComponent)
    }
  ]
}
```

### 9. `HomeComponent` — wire the eye icon

In `home.component.html`, update the `app-post-card` binding to handle the new
`quickView` output:
```html
<app-post-card
  [post]="post"
  mode="card"
  (quickView)="onQuickView(post)">
  ...
</app-post-card>
```

In `home.component.ts`, inject `SessionQueueService` and add the handler:
```typescript
private sessionQueue = inject(SessionQueueService);

onQuickView(post: Post): void {
  // Pass the full current batch so the service can seed the queue
  const currentBatch = this.vm$   // read current posts from vm state
    ? (/* extract current posts from vm scan state */)
    : [];
  this.sessionQueue.openSession(post, currentBatch);
  this.router.navigate(['quick-view', post.uuid], { relativeTo: this.route });
}
```

To extract `currentBatch` from `vm$`: add a local `currentPosts` signal or use
`toSignal(this.vm$.pipe(map(vm => vm.posts)))` so the handler can read it
synchronously. Read the existing `vm$` scan structure before deciding — do not
add a second subscription.

### 10. Overlay visibility

Read `home.component.ts` and find `isDrawerOpen()`. It currently checks if the
URL contains `/view/`. Extend it to also return true for `/quick-view/`:
```typescript
isDrawerOpen = toSignal(
  this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(() =>
      this.router.url.includes('/view/') ||
      this.router.url.includes('/quick-view/')
    ),
    startWith(
      this.router.url.includes('/view/') ||
      this.router.url.includes('/quick-view/')
    )
  )
);
```

The existing `div.immersive-overlay [class.active]` and the existing
`<router-outlet>` in home will render the `QuickViewContainerComponent`
automatically when the route activates — no new outlet needed.

---

## Constraints
- Zero HTTP requests when opening or navigating within quick view
- `event.stopPropagation()` on eye icon click is mandatory — card body click
  must not also trigger focus read
- Do not change `PostDetail` component or its route
- Do not change the `vm$` stream shape in `HomeComponent`
- `QuickViewRailComponent` and `QuickViewContentComponent` are pure presentational
  — no router or service injection
- Standalone components only — no NgModule
- `OnPush` change detection on all three quick-view components
- Do not use `localStorage` or `sessionStorage` — queue lives in service memory only
- SCSS must use existing platform CSS variables — no new color values
- `ng build --prod` must produce zero new errors or warnings

---

## Expected Output
1. `src/app/core/session-queue.service.ts` — new service
2. `src/app/features/post-card/post-card.component.ts` — `quickView` output added
3. `src/app/features/post-card/post-card.component.html` — eye icon button added
4. `src/app/features/post-card/post-card.component.scss` — `.btn-quick-view` style
5. `src/app/features/quick-view/quick-view-container.component.ts` — new
6. `src/app/features/quick-view/quick-view-container.component.html` — new
7. `src/app/features/quick-view/quick-view-container.component.scss` — new
8. `src/app/features/quick-view/quick-view-rail.component.ts` — new
9. `src/app/features/quick-view/quick-view-rail.component.html` — new
10. `src/app/features/quick-view/quick-view-rail.component.scss` — new
11. `src/app/features/quick-view/quick-view-content.component.ts` — new
12. `src/app/features/quick-view/quick-view-content.component.html` — new
13. `src/app/features/quick-view/quick-view-content.component.scss` — new
14. `src/app/features/quick-view/index.ts` — barrel export
15. `src/app/app.routes.ts` — `quick-view/:uuid` child route added
16. `src/app/features/home/home.component.ts` — `onQuickView()` handler,
    `isDrawerOpen()` extended, `SessionQueueService` injected
17. `src/app/features/home/home.component.html` — `(quickView)` binding on
    `app-post-card`

---

## Evaluation Checklist
- [ ] Clicking eye icon opens quick view overlay at `/home/quick-view/:uuid`
- [ ] Clicking card body still opens focus read at `/home/view/:uuid` (unchanged)
- [ ] `event.stopPropagation()` confirmed — eye icon does not also trigger card click
- [ ] Network tab shows zero new requests when opening quick view
- [ ] Network tab shows zero new requests when navigating between posts in the rail
- [ ] Rail shows posts from the current home batch with correct active highlight
- [ ] Closing quick view returns to home grid — URL back to `/home`
- [ ] `isDrawerOpen()` is true for both `/view/` and `/quick-view/` URLs
- [ ] Existing focus read (`view/:uuid`) unchanged and still functional
- [ ] `ng build --prod` zero errors

---

## Log
<!-- Append after each agent run. Never delete old entries. -->

### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: