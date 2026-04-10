# Task: Writer Console - UI Refactor

Read every file inside ng-frontend/src/app/features/dashboard/writer-console/
in full before writing any code. Also read ng-frontend/src/app/shared/ui/post-card/
to understand the PostCard @Input interface.

This task is a structural refactor and static UI implementation.
No backend calls. No service integration. No logic beyond window state.

## Step 1 — Update mock API and create data-access interfaces

### 1a — Data-access interfaces
Create ng-frontend/src/app/features/dashboard/data-access/writer.models.ts

Define these interfaces only — no mock data, no functions:

export interface WriterPost {
  uuid:         string;
  title:        string;
  description:  string;
  hashtags:     string[];
  images:       string[];
  status:       'draft' | 'published';
  lastEditedAt: string;
  publishedAt?: string;
  views?:       number;
  readTime?:    number;
  authorName:   string;
  authorAvatar?: string;
}

export interface WriterStats {
  totalPosts:     number;
  totalDrafts:    number;
  totalPublished: number;
}

### 1b — Update mock API
Read ng-frontend/src/app/core/services/ in full to find the existing mock
API file. Do not create a new file — add to the existing one.

Import WriterPost and WriterStats from features/dashboard/data-access/writer.models.ts.

Append to the existing mock API file:

import { WriterPost, WriterStats } from '../../features/dashboard/data-access/writer.models';

export const MOCK_WRITER_POSTS: WriterPost[] = [
  {
    uuid: 'mock-001',
    title: 'Mastering Angular Signals',
    description: 'A deep dive into Angular newest reactive primitive...',
    hashtags: ['angular', 'frontend'],
    images: ['https://wallpapercave.com/wp/wp10822452.jpg'],
    status: 'published',
    lastEditedAt: '2026-03-15T10:00:00Z',
    publishedAt: '2026-03-15T12:00:00Z',
    views: 2100,
    readTime: 5,
    authorName: 'NkDev'
  },
  {
    uuid: 'mock-002',
    title: 'CI/CD Pipeline deep dive',
    description: 'Slow pipelines kill deployment frequency...',
    hashtags: ['devops', 'cicd'],
    images: [],
    status: 'draft',
    lastEditedAt: '2026-04-09T18:00:00Z',
    authorName: 'NkDev'
  },
  {
    uuid: 'mock-003',
    title: 'Rate limiting with Redis',
    description: 'Token bucket, sliding window, and leaky bucket...',
    hashtags: ['backend', 'redis'],
    images: ['https://wallpapercave.com/wp/wp10822462.jpg'],
    status: 'published',
    lastEditedAt: '2026-02-20T09:00:00Z',
    publishedAt: '2026-02-20T10:00:00Z',
    views: 980,
    readTime: 3,
    authorName: 'NkDev'
  }
];

export const MOCK_WRITER_STATS: WriterStats = {
  totalPosts: 3,
  totalDrafts: 1,
  totalPublished: 2
};

export function getMockWriterPosts(): WriterPost[] {
  return MOCK_WRITER_POSTS;
}

export function getMockWriterStats(): WriterStats {
  return MOCK_WRITER_STATS;
}
## Step 2 — Create subcomponents

Create each subcomponent as a standalone OnPush component.
For each, create only the .ts and .html file — no SCSS unless the parent
writer-console already uses SCSS (match existing extension).

### post-form component
Path: writer-console/components/post-form/post-form.ts

@Component({
  selector: 'app-post-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class PostFormComponent {
  @Output() saved  = new EventEmitter<Partial<WriterPost>>();
  @Output() published = new EventEmitter<Partial<WriterPost>>();
}

Template: title input, description textarea, cover image upload area
(click to upload label, dashed border), hashtag input row with add button,
Save Draft button and Publish button side by side.
Use only Bootstrap utility classes already present in the project.
No inline styles.

### post-list component
Path: writer-console/components/post-list/post-list.ts

@Component({ selector: 'app-post-list', standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule] })
export class PostListComponent {
  @Input({ required: true }) posts: WriterPost[] = [];
  @Output() editPost    = new EventEmitter<WriterPost>();
  @Output() deletePost  = new EventEmitter<string>();   // emits uuid
  @Output() previewPost = new EventEmitter<WriterPost>();
}

Template: @for loop over posts. Each row: thumbnail (first image or placeholder),
title, status badge (draft/published), last edited date, action buttons
(edit pencil, preview eye, delete x). Use existing .ab and .post-row
CSS classes if they exist in writer-console — otherwise Bootstrap only.

### post-edit component
Path: writer-console/components/post-edit/post-edit.ts

@Component({ selector: 'app-post-edit', standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule, FormsModule] })
export class PostEditComponent {
  @Input({ required: true }) post!: WriterPost;
  @Output() saved     = new EventEmitter<WriterPost>();
  @Output() published = new EventEmitter<WriterPost>();
  @Output() deleted   = new EventEmitter<string>();
  @Output() closed    = new EventEmitter<void>();
}

Template: same fields as post-form but pre-filled from [post] input.
Two-way binding on title, description, hashtags.
Buttons: Save draft, Publish post (green), Delete (red outline), close X.

### post-preview component
Path: writer-console/components/post-preview/post-preview.ts

@Component({ selector: 'app-post-preview', standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, imports: [CommonModule] })
export class PostPreviewComponent {
  @Input({ required: true }) post!: WriterPost;
  @Output() closed = new EventEmitter<void>();
}

Template: label "Feed card preview", render a simplified card matching
the home post-card layout (tag pill, title, description truncated to 3 lines,
author row). Do NOT import app-post-card — PostPreview receives a WriterPost
not a Post, and duplicating the card layout here avoids a type adapter.
Close button at top right.

## Step 3 — Refactor WriterConsole orchestrator

In writer-console.ts:

Import getMockWriterPosts and getMockWriterStats from the mock API.
Remove all existing static data defined inline in the component.

Define these signals only — no business logic:

posts         = signal<WriterPost[]>(getMockWriterPosts());
stats         = signal<WriterStats>(getMockWriterStats());
activePost    = signal<WriterPost | null>(null);

// Window open/closed state
showNewForm   = signal(true);
showList      = signal(true);
showEdit      = signal(false);
showPreview   = signal(false);

// Handlers — each is one or two lines max
onEditPost(post: WriterPost)    { this.activePost.set(post); this.showEdit.set(true); this.showPreview.set(true); this.showNewForm.set(false); }
onCloseEdit()                   { this.showEdit.set(false); this.showPreview.set(false); this.activePost.set(null); }
onPreviewPost(post: WriterPost) { this.activePost.set(post); this.showPreview.set(true); }
onClosePreview()                { this.showPreview.set(false); }
toggleNewForm()                 { this.showNewForm.update(v => !v); }
toggleList()                    { this.showList.update(v => !v); }

Imports: PostFormComponent, PostListComponent, PostEditComponent,
PostPreviewComponent — add all four to the imports[] array.

## Step 4 — Update writer-console.html

Replace the current template with the window-based layout matching the
approved UI design mockup. Four panels arranged in a flex row:

Left column (160px fixed, flex-shrink:0):
  - Compact strip for New post — shows panel header + toggle button
    @if (!showNewForm()) show collapsed strip with + button calling toggleNewForm()
    @if (showNewForm())  show full panel containing <app-post-form>

  - Compact strip for My posts — shows panel header + count + toggle button
    @if (!showList()) show collapsed strip
    @if (showList())  show full panel containing <app-post-list [posts]="posts()">

Right area (flex:1):
  @if (showEdit() && activePost()) {
    panel containing <app-post-edit [post]="activePost()!"
      (closed)="onCloseEdit()" ...>
  }
  @if (showPreview() && activePost()) {
    panel containing <app-post-preview [post]="activePost()!"
      (closed)="onClosePreview()">
  }
  @if (!showEdit() && !showPreview()) {
    empty state div: "Click + to expand a panel or select a post to edit"
  }

All panel wrapper divs use Bootstrap utility classes only.
No inline styles except where a specific pixel width is required for
the left column (style="width:160px").

## Step 5 — Build check
cd ng-frontend && ng build 2>&1 | tail -30

Fix any import path errors before reporting. Report only unresolvable errors.

## Constraints
- Do not call any HTTP endpoint — mock data only
- Do not modify any file outside features/dashboard/writer-console/
- Do not import app-post-card into post-preview — use a local card layout
- All subcomponents must be standalone and OnPush
- No new npm packages
- Writer-console.ts must contain only signals and one-line handlers —
  no template logic, no data transformation
- All interfaces must be imported from features/dashboard/data-access/writer.models.ts —
  never redefined inline in components or the mock API file

## Expected output
1. writer-console/mock-api/writer-mock.api.ts
2. writer-console/components/post-form/post-form.ts + .html
3. writer-console/components/post-list/post-list.ts + .html
4. writer-console/components/post-edit/post-edit.ts + .html
5. writer-console/components/post-preview/post-preview.ts + .html
6. writer-console/writer-console.ts — refactored orchestrator
7. writer-console/writer-console.html — window layout
8. ng-frontend/src/app/features/dashboard/data-access/writer.models.ts — new interfaces

## Evaluation checklist
- [ ] ng build passes with zero errors
- [ ] No static data defined in writer-console.ts — all from mock-api
- [ ] writer-console.ts contains only signals and one-line handlers
- [ ] All four subcomponents are standalone and OnPush
- [ ] Window toggle behaviour works: + collapses/expands each panel
- [ ] Clicking edit on a post opens edit + preview panels, collapses new form
- [ ] Closing edit returns to empty right area


## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: