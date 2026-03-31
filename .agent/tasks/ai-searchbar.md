# Task: Create `AiResultsPanelComponent` for AI Search Results

## Scope
- [ ] Create `ai-results-panel` component under `ng-frontend/src/app/features/ai-results-panel/`
- [ ] Move all AI results rendering logic out of `home.component.html` and `home.component.ts` into the new component
- [ ] Component accepts AI state as `@Input()` — home just pipes `aiResults$ | async` into it
- [ ] Component follows existing Angular structure: standalone, OnPush, feature folder convention
- [ ] Panel layout fixes: constrained height with scroll when results present, no vertical stretch when empty
- [ ] Matches existing design tokens (glass card, Bootstrap utility classes, `bi` icons) — no new CSS framework

## Role
Angular component architect. Mirror the structure of existing feature components (`post-card`, `search-bar`). Do not introduce new dependencies. Do not touch `home.component.ts` business logic.

## Context

### Current problem
AI results are inlined directly in `home.component.html` inside `div.related-links-panel`. This causes:
- Layout clash: panel stretches when no results, compresses when results are present alongside the feed
- No separation of concerns — home template is becoming a dumping ground
- Style deviates from the platform's component-based pattern

### Existing component pattern to follow
```
ng-frontend/src/app/features/
  post-card/
    post-card.component.ts
    post-card.component.html
    post-card.component.scss
  search-bar/
    search-bar.component.ts
    search-bar.component.html
    search-bar.component.scss
```

### Existing interfaces (already defined in RemoteApi)
```typescript
interface ExternalDoc {
  source_url: string;
  source_name: string;
  source_small_headline: string;
  source_small_description: string;
  favicon: string;
}
interface SimilarDoc {
  uuid: string;
  title: string;
  description: string;
  score: number;
}
interface AiSearchResponse {
  query: string;
  expanded_query: string;
  similar_docs: SimilarDoc[];
  relevant_ext_docs: ExternalDoc[];
}
// AI stream state shape (from home.component.ts aiResults$)
type AiResultsState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'loaded'; data: AiSearchResponse }
  | { state: 'error'; message: string }
```

## Task

### 1. File structure to create
```
ng-frontend/src/app/features/ai-results-panel/
  ai-results-panel.component.ts
  ai-results-panel.component.html
  ai-results-panel.component.scss
  index.ts                          ← barrel export
```

### 2. `ai-results-panel.component.ts`
```typescript
@Component({
  selector: 'app-ai-results-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './ai-results-panel.component.html',
  styleUrl:    './ai-results-panel.component.scss'
})
export class AiResultsPanelComponent {
  @Input() aiState: AiResultsState = { state: 'idle' };
  @Output() docSelected = new EventEmitter<string>(); // emits uuid
}
```

### 3. Template rules
- Render nothing (not even the wrapper) when `state === 'idle'`
- Loading: single line spinner/text, no height jump
- Loaded: 
  - `similar_docs` section only if `similar_docs.length > 0`
  - `relevant_ext_docs` section only if `relevant_ext_docs.length > 0`
  - Panel has `max-height: 70vh; overflow-y: auto` so it never stretches the layout
  - Each external doc row: favicon (16x16, hide on error) + headline + source name
  - `track src.source_url || $index` and `track doc.uuid || $index`
- Error: single line error text

### 4. SCSS rules
- No hardcoded colors — use existing CSS variables from the platform (`--bs-*`, existing glass card vars)
- `.ai-results-panel` is the BEM root
- Panel must not impose its own `position` — let the parent (home) control placement
- `min-height: 0` on the root so it collapses cleanly when idle

### 5. `home.component.html` cleanup
Replace the entire `<aside class="related-links-panel ...">` block with:
```html
<app-ai-results-panel
  [aiState]="(aiResults$ | async) ?? { state: 'idle' }"
  (docSelected)="openDetails($event)">
</app-ai-results-panel>
```

### 6. `home.component.ts` cleanup
- Remove any inline AI state handling that now lives in the component
- `aiResults$` stream stays in home (it is data orchestration, not view logic)
- Add `AiResultsPanelComponent` to home's `imports[]`

## Constraints
- Standalone component, no NgModule
- OnPush change detection only
- No new npm packages
- SCSS must not override global styles
- Do not touch `aiResults$` stream logic in home.ts

## Expected Output
1. `ai-results-panel.component.ts`
2. `ai-results-panel.component.html`
3. `ai-results-panel.component.scss`
4. `index.ts` barrel
5. `home.component.html` — `<aside>` replaced with `<app-ai-results-panel>`
6. `home.component.ts` — import added, no other changes

## Evaluation Checklist
- [ ] `ng build` passes with zero errors
- [ ] Panel is invisible when `state === 'idle'` — no empty box in layout
- [ ] Panel does not stretch when only 1–2 results present
- [ ] Panel scrolls internally when results overflow — does not push page content
- [ ] favicon `(error)` handler hides broken images without layout shift
- [ ] Clicking a `similar_doc` emits `docSelected` and home navigates correctly
- [ ] No inline styles except the favicon error handler

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: