---
generated: 2026-04-05
source: quick-view-ui-update.md
phases: 2
---

# Plan — Quick View — Rail Polish & Mobile Responsive Layout

## Scope confirmation
Polish the "Quick View" feature with the following improvements:
- **Rail Polish**: 260px width, title update, metadata per row, progress count, and pagination controls.
- **Keyboard Navigation**: ArrowUp/Down/J/K for navigation, ArrowRight for reading, and Esc for closing. Automatic scrolling to active item.
- **Content Polish**: Slide direction synchronization with navigation, and an empty queue fallback state.
- **Mobile Responsive**: Content-first layout for ≤600px, hidden rail, "Up next" list below content, and swipe gestures.

## Files inventory
| Action | File | Reason |
|--------|------|--------|
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-rail.component.html | Update title, add meta, count, pagination, and kbd hints |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-rail.component.css | Sizing, meta styles, and keyboard hint styles |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-container.component.ts | Keyboard listener, scroll logic, slide direction management, and empty fallback |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-container.component.html | Add empty fallback block |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-container.component.css | Mobile breakpoint (≤600px) and rail visibility |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-content.component.ts | SlideDir input, isMobile check, upNext computed, and touch handlers |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-content.component.html | "Up next" section and touch event bindings |
| MODIFY | ng-frontend/src/app/features/quick-view/quick-view-content.component.css | Slide animations and "Up next" styles |

## Files that must not change
- `ng-frontend/src/app/core/services/session-queue.service.ts` — queue management is complete.
- `ng-frontend/src/app/app.routes.ts` — route tree is fixed.
- `ng-frontend/src/app/features/home/home.ts` — home integration is complete.

## Service boundaries crossed
None — pure UI/UX enhancement.

## Missing context
None — task is complete.

## Phase breakdown

### Phase 1 — Rail & Keyboard (Web)
Goal: Polish the rail UI and implement robust keyboard navigation.
Files: 
- `ng-frontend/src/app/features/quick-view/quick-view-rail.component.*`
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.html`
- `ng-frontend/src/app/features/quick-view/quick-view-content.component.css`
Done when: Rail shows the new UI elements and keyboard navigation works as specified with smooth scrolling.

### Phase 2 — Mobile Responsive (≤600px)
Goal: Implement the mobile-first layout and touch gestures.
Files:
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.css`
- `ng-frontend/src/app/features/quick-view/quick-view-content.component.*`
Done when: At ≤600px the rail is hidden, "Up next" is visible, and swipe gestures navigate the session.

## Risks
- **Touch Gesture Conflict**: Swipe gestures might conflict with natural scroll if not implemented carefully with a threshold.
- **Scroll Alignment**: `scrollIntoView` might behave differently across browsers; `block: 'nearest'` is chosen for stability.
- **Viewport Shifts**: Mobile layout transitions (showing/hiding rail) should be smooth or instantaneous as per design.
