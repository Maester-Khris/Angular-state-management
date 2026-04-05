---
status: in-progress
phase: 2-of-2
assigned: claude-code
generated: 2026-04-05
---

# Execution brief — Quick View — Rail Polish & Keyboard (Web)

## Session bootstrap
Read in this order before any action:
1. CLAUDE.md (repo root)
2. ng-frontend/CLAUDE.md
3. .agent/tasks/quick-view-ui-update.md
4. .agent/tasks/quick-view-ui-update.plan.md

## Current phase: Phase 1 — Rail & Keyboard (Web)
Goal: Polish the rail UI and implement robust keyboard navigation.
Files:
- `ng-frontend/src/app/features/quick-view/quick-view-rail.component.html`
- `ng-frontend/src/app/features/quick-view/quick-view-rail.component.css`
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.html`
- `ng-frontend/src/app/features/quick-view/quick-view-content.component.css`

## Exact file list for this session
MODIFY `ng-frontend/src/app/features/quick-view/quick-view-rail.component.html`
MODIFY `ng-frontend/src/app/features/quick-view/quick-view-rail.component.css`
MODIFY `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`
MODIFY `ng-frontend/src/app/features/quick-view/quick-view-container.component.html`
MODIFY `ng-frontend/src/app/features/quick-view/quick-view-content.component.css`

## Must not change this session
- `ng-frontend/src/app/features/quick-view/quick-view-content.component.ts` (wait until Phase 2)
- `ng-frontend/src/app/core/services/session-queue.service.ts`

## Build check
cd ng-frontend && ng build 2>&1 | tail -20

## Done when
- [ ] Rail is 260px wide with "YOUR READING SESSION" title.
- [ ] Rail rows show author/time metadata.
- [ ] Count label and pagination controls functional in rail.
- [ ] Keyboard nav (↑↓/JK) works and triggers `scrollActiveIntoView`.
- [ ] ArrowRight navigates to full post.
- [ ] Slide animations triggered correctly (left for forward, right for back).
- [ ] Empty queue fallback renders correctly.
- [ ] Build check passes with zero errors.

## On completion
Update this file:
  phase: 1-of-2 → 2-of-2
  Append to Log:
  ### Run 1 — 2026-04-05
  Output: [what was built]
  Gap:    [anything unfinished or deviated]
  Action: [what the next session needs to know]

## Hard stops
- Do not begin Phase 2 in this session.
- Do not modify files outside the exact file list above.
