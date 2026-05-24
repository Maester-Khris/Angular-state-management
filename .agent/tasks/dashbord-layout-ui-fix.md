Read the following files in full before making any change:
- ng-frontend/src/app/features/dashboard/shell/shell.html and shell.css
- ng-frontend/src/app/features/dashboard/sidebar/sidebar.component.html and .css
- ng-frontend/src/app/features/dashboard/writer-console/writer-console.html and .css
- ng-frontend/src/app/features/dashboard/writer-console/components/post-list/post-list.html and .ts
- ng-frontend/src/app/features/dashboard/writer-console/components/post-preview/post-preview.html and .ts
- ng-frontend/src/app/shared/ui/post-card/post-card.component.ts  ← read @Input interface
- ng-frontend/src/app/core/remote-api.service.ts  ← find the Post interface

Apply each fix below independently. Do not change any TypeScript logic
beyond what is explicitly described.

## Fix 1 — Sidebar background and full height

In sidebar component CSS:

:host {
  display: flex;
  flex-direction: column;
  height: 100%;               /* takes full height of flex parent */
  background: var(--color-background-secondary, #F1F0ED);
  border-right: 0.5px solid var(--color-border-tertiary);
}

Remove any explicit background set on the inner wrapper div if present —
the :host rule covers it.

In shell.css, ensure .dashboard-container has:
  align-items: stretch;       /* was flex-start — change to stretch */

This makes the sidebar fill the full viewport height alongside the content.

## Fix 2 — Consistent horizontal spacing

In writer-console.css, ensure the top-level flex row has:
  gap: 16px;
  padding: 24px;

Remove any margin-left, margin-right, or padding set on individual
panel wrapper divs that creates uneven spacing. All horizontal spacing
between panels must come from the parent gap only.

## Fix 3 — Consistent border radius

Read the sidebar component CSS and find the border-radius value it uses
on its card/container. Use that exact value as the reference.

Apply that same border-radius to:
- .panel (or whatever class wraps each writer console window)
- The empty state container
- The compact strip headers

Do not hardcode a new value — read the sidebar value first and reuse it.

## Fix 4 — Post list date font size

In post-list.html, find the element displaying the date (lastEditedAt,
publishedAt). Add or update its class to reduce font size:
  font-size: 11px;
  color: var(--color-text-tertiary, #94a3b8);

If the date is inside a shared meta row with the status badge, apply
the font-size only to the date span, not the entire row.

## Fix 5 — Window control buttons (all panels)

Find every panel header close button, collapse button, and expand button
across all panel components (post-list, post-edit, post-form, post-preview,
writer-console header controls).

Replace their current style with:
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 0.5px solid var(--color-border-secondary);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  color: var(--color-text-tertiary);

On hover:
  background: var(--color-background-secondary);

Apply this as a shared class .panel-ctrl in writer-console.css so all
panels inherit it. Do not add inline styles.

## Fix 6 — Post list pagination

In post-list.html, add a pagination row at the bottom of the component,
after the @for loop and outside the list wrapper:

<div class="list-pagination">
  <button class="panel-ctrl" [disabled]="currentPage === 0"
    (click)="prevPage()">‹</button>
  <span class="page-indicator">{{ currentPage + 1 }} / {{ totalPages }}</span>
  <button class="panel-ctrl" [disabled]="currentPage >= totalPages - 1"
    (click)="nextPage()">›</button>
</div>

In post-list.ts, add:
  pageSize  = 5;
  currentPage = 0;
  get totalPages() { return Math.ceil(this.posts.length / this.pageSize); }
  get pagedPosts() { return this.posts.slice(
    this.currentPage * this.pageSize,
    (this.currentPage + 1) * this.pageSize); }
  prevPage() { if (this.currentPage > 0) this.currentPage--; }
  nextPage() { if (this.currentPage < this.totalPages - 1) this.currentPage++; }

In the template @for loop, change posts to pagedPosts.

In post-list.css:
.list-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 0 4px;
  border-top: 0.5px solid var(--color-border-tertiary);
  margin-top: 8px;
}
.page-indicator {
  font-size: 11px;
  color: var(--color-text-tertiary);
  min-width: 40px;
  text-align: center;
}

## Fix 7 — Post preview uses real PostCard component

In post-preview.ts:
- Import PostCardComponent from shared/ui/post-card
- Import the Post interface from remote-api.service.ts
- Add a computed property that maps WriterPost to Post:

  protected previewPost = computed((): Post => ({
    uuid:         this.post.uuid,
    title:        this.post.title,
    description:  this.post.description,
    authorName:   this.post.authorName,
    authorAvatar: this.post.authorAvatar,
    images:       this.post.images,
    hashtags:     this.post.hashtags,
    isPublic:     this.post.status === 'published',
    isDraft:      this.post.status === 'draft',
    views:        this.post.views ?? 0,
    readTime:     this.post.readTime,
    publishedAt:  this.post.publishedAt,
  }));

- Add PostCardComponent to the imports[] array

In post-preview.html, replace the simulated card markup with:
  <app-post-card [post]="previewPost()" mode="card"></app-post-card>

Remove all existing preview-box, pv-img, pv-body, pv-tag, pv-title,
pv-desc markup — the PostCard component renders all of this.

## Fix 8 — Empty state with dotted border

Find the empty state div in writer-console.html (the one showing
"Click + to expand a panel or select a post to edit").

Replace its current styles with a CSS class .empty-workspace:

.empty-workspace {
  flex: 1;
  min-height: 200px;
  border: 1.5px dashed var(--color-border-secondary);
  border-radius: [same value as sidebar — read Fix 3];
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

## Build check
cd ng-frontend && ng build 2>&1 | tail -20

## Constraints
- Do not change any signal logic or event emitters
- Do not change routing
- sidebar border-radius value must be read from existing CSS — not hardcoded
- PostCard @Input must use the mapped previewPost() computed — not the
  raw WriterPost object directly
- All button styles must use the shared .panel-ctrl class —
  no per-component button overrides

## Evaluation checklist
- [ ] Sidebar has a distinguishable background from content area
- [ ] Sidebar extends full viewport height
- [ ] All panels have the same border-radius as the sidebar
- [ ] Horizontal spacing between all panels is uniform (no uneven gaps)
- [ ] Post list dates are visually smaller and muted
- [ ] All window control buttons are square with rounded corners
- [ ] Post list shows 5 posts per page with prev/next at the bottom
- [ ] Post preview renders the real PostCard component
- [ ] Empty workspace state shows a dotted rounded border, centered text
- [ ] ng build passes with zero errors