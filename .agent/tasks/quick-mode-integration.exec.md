---
status: in-progress
phase: 3-of-3
assigned: claude-code
generated: 2026-04-04
---

# Execution brief — Quick View — Card Button + Overlay Integration

## Session bootstrap
Read in this order before any action:
1. CLAUDE.md (repo root)
2. ng-frontend/CLAUDE.md
3. .agent/tasks/quick-mode-integration.md
4. .agent/tasks/quick-mode-integration.plan.md

## Current phase: Phase 3 — Home Integration & Polish
Goal: Wire the components together in `HomeComponent` and refine UI/UX.
Files:
- `ng-frontend/src/app/features/home/home.ts`
- `ng-frontend/src/app/features/home/home.html`

## Exact file list for this session
MODIFY `ng-frontend/src/app/features/home/home.ts`
MODIFY `ng-frontend/src/app/features/home/home.html`

## Must not change this session
- `vm$` stream scan logic in `home.ts` (do not break post accumulation)
- Existing `openDetails` search/click behavior

## Build check
cd ng-frontend && ng build 2>&1 | tail -20

## Done when
- [ ] `SessionQueueService` injected into `HomeComponent`.
- [ ] `isDrawerOpen` Signal extended to match both `/view/` and `/quick-view/`.
- [ ] `onQuickView(post)` handler implemented using `toSignal(vm$.pipe(map(v => v.posts)))`.
- [ ] `(quickView)` output bound to `app-post-card` in `home.html`.
- [ ] Clicking eye icon opens the Quick View overlay.
- [ ] Clicking card body still opens the full focus read.
- [ ] Build check passes with zero errors.

## On completion
Update this file:
  phase: 3-of-3 → done
  Append to Log:
  ### Run 3 — 2026-04-04
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [what the next session needs to know]

### Run 2 — 2026-04-04
Output: Created all 9 quick-view files (QuickViewContainerComponent, QuickViewRailComponent, QuickViewContentComponent — each with .ts/.html/.css). Created index.ts barrel export. Registered `quick-view/:uuid` as a second child of `home` in app.routes.ts parallel to `view/:uuid`. Fixed an optional-chain warning in the content template (post.createdBy is non-nullable string).
Gap:    None — all Phase 2 checklist items satisfied. home/* untouched as required.
Action: Phase 3 wires home integration: inject SessionQueueService into HomeComponent, add onQuickView() handler, extend isDrawerOpen() to also match /quick-view/, bind (quickView) output on app-post-card in home.html. Read home.ts vm$ scan carefully before touching — do not change the shape. Use toSignal(vm$.pipe(map(v => v.posts))) for synchronous batch read in onQuickView().

### Run 1 — 2026-04-04
Output: Created `SessionQueueService` (openSession, enqueue, navigateTo, clear, Signal state, cap 30). Added `quickView` @Output and `onQuickView(event)` to `PostCard`. Added `.btn-quick-view` eye icon button to card-mode footer (left of projected actions). Added `.btn-quick-view` CSS using platform `--bs-primary` variable. Build passes with zero new errors (pre-existing budget warnings only).
Gap:    None — all Phase 1 checklist items satisfied.
Action: Phase 2 starts with quick-view feature components and route registration. Read `app.routes.ts` and `home.component.ts` before touching the route tree.

## Hard stops
- Do not begin Phase 2 in this session even if Phase 1 finishes early.
- Do not modify files outside the exact file list above.
- If a required file is missing or unreadable, stop and report — do not guess.
