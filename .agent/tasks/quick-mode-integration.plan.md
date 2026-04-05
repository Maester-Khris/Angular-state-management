---
generated: 2026-04-04
source: quick-mode-integration.md
phases: 3
---

# Plan — Quick View — Card Button + Overlay Integration

## Scope confirmation
Add a "Quick View" feature to the Angular frontend. This includes:
- A new `SessionQueueService` for in-memory post queue management (Signal-based, cap 30).
- Adding a "Quick View" eye icon button to `PostCardComponent`.
- Creating a new feature folder `src/app/features/quick-view/` with three components: `QuickViewContainerComponent`, `QuickViewRailComponent`, and `QuickViewContentComponent`.
- Adding a child route `quick-view/:uuid` under `home` in `app.routes.ts`.
- Integrating the button click in `HomeComponent` to populate the queue and navigate to the new route.
- Extending `isDrawerOpen` in `HomeComponent` to handle the new route and show the immersive overlay.

## Files inventory
| Action | File | Reason |
|--------|------|--------|
| CREATE | ng-frontend/src/app/core/services/session-queue.service.ts | Core service for queue management |
| MODIFY | ng-frontend/src/app/shared/ui/post-card/post-card.ts | Add @Output and click handler |
| MODIFY | ng-frontend/src/app/shared/ui/post-card/post-card.html | Add eye icon button |
| MODIFY | ng-frontend/src/app/shared/ui/post-card/post-card.css | Style for .btn-quick-view |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-container.component.ts | Orchestrator/Container |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-container.component.html | Container template |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-container.component.scss | Container styles (using platform variables) |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-rail.component.ts | Left session rail component |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-rail.component.html | Rail template |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-rail.component.scss | Rail styles |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-content.component.ts | Right content preview component |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-content.component.html | Content template |
| CREATE | ng-frontend/src/app/features/quick-view/quick-view-content.component.scss | Content styles + slide transitions |
| CREATE | ng-frontend/src/app/features/quick-view/index.ts | Barrel export |
| MODIFY | ng-frontend/src/app/app.routes.ts | Register child route |
| MODIFY | ng-frontend/src/app/features/home/home.ts | Wire eye icon, update isDrawerOpen |
| MODIFY | ng-frontend/src/app/features/home/home.html | Bind quickView output |

## Files that must not change
- `ng-frontend/src/app/features/post-detail/*` — existing focus read must remain untouched.
- `ng-frontend/src/app/core/services/remote-api.ts` — no new HTTP methods needed.
- `vm$` stream shape in `HomeComponent` — do not break downstream dependencies.

## Service boundaries crossed
None — this is a pure frontend feature using existing data in memory.

## Missing context
None — task is complete and well-defined.

## Phase breakdown

### Phase 1 — Core Service & Shared UI
Goal: Implement the session queue logic and the trigger button.
Files: 
- `ng-frontend/src/app/core/services/session-queue.service.ts`
- `ng-frontend/src/app/shared/ui/post-card/post-card.ts`
- `ng-frontend/src/app/shared/ui/post-card/post-card.html`
- `ng-frontend/src/app/shared/ui/post-card/post-card.css`
Done when: `PostCardComponent` emits a `quickView` event and `SessionQueueService` is ready to be injected.

### Phase 2 — Quick View Components
Goal: Build the overlay feature components and register the route.
Files:
- `ng-frontend/src/app/features/quick-view/*`
- `ng-frontend/src/app/app.routes.ts`
Done when: `/home/quick-view/:uuid` route is registered and components are rendered when navigable.

### Phase 3 — Home Integration & Polish
Goal: Wire the components together in `HomeComponent` and refine UI/UX.
Files:
- `ng-frontend/src/app/features/home/home.ts`
- `ng-frontend/src/app/features/home/home.html`
Done when: Eye icon click opens the overlay, navigation between posts works, and "Read full post" navigates correctly.

## Risks
- **Transition Jitters**: Slide transitions need careful CSS handling to avoid layout shifts.
- **Route Sync**: Deep-linking directly to `/home/quick-view/:uuid` with an empty queue needs to be handled gracefully (should redirect or show a reasonable fallback).
- **Infinite Scroll Sync**: Ensuring `SessionQueueService.enqueue` is called when `HomeComponent` fetches new batches.
- **vm$ currentBatch extraction (Phase 3)**: HomeComponent must expose current
  posts to onQuickView() without a second subscription or stream mutation.
  Recommended approach: toSignal(vm$.pipe(map(v => v.posts))) assigned at
  construction time. Agent must read vm$ scan structure before implementing.
