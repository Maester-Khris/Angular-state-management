# Task: Quick View Reload — Redirect to Home

---
status: pending
phase: 1-of-1
assigned: claude-code
generated: 2026-04-06
---

## Scope
- [ ] Detect empty session queue on `QuickViewContainerComponent` init
- [ ] Redirect to `/home` with `replaceUrl: true` when queue is empty
- [ ] No notification, no fallback UI — silent redirect only

## Role
Angular frontend engineer. Single-file change in
`QuickViewContainerComponent`. Read the file in full before editing.
Do not touch any other file.

## Context

### Why this happens
`SessionQueueService` is in-memory only. On page reload the Angular app
bootstraps fresh — the queue is empty. The route `/home/quick-view/:uuid`
activates `QuickViewContainerComponent` before any posts are loaded.
Without a guard, the component renders with an empty queue and a blank
content panel.

### Why redirect to home and not focus read
Quick view exists to let the user peek at a post within a session context.
On reload that context is gone. Sending the user to focus read assumes they
wanted to read the full post — they may not have. Home is the neutral
correct destination: it is where sessions are created, and the user can
re-open quick view from there if they want.

### Why not sessionStorage
Persisting the queue to storage introduces stale data risk (different
search in another tab), unbounded growth, and inconsistent restore
behaviour. The redirect is simpler, honest, and requires zero ongoing
maintenance.

## Task

### 1. Read first
- `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`

### 2. Add empty queue guard to ngOnInit

Find the existing `ngOnInit` method. At the very top, before any other
logic, add:
```typescript
ngOnInit() {
  const uuid = this.route.snapshot.paramMap.get('uuid');

  // Queue is empty — page was reloaded or URL was accessed directly.
  // Session context is lost. Return to home silently.
  if (this.queue.queue().length === 0) {
    this.router.navigate(['/home'], { replaceUrl: true });
    return;  // stop — do not execute any further init logic
  }

  // Existing init logic below — do not change
  if (uuid) {
    const idx = this.queue.queue().findIndex(p => p.uuid === uuid);
    if (idx !== -1) this.queue.navigateTo(idx);
  }
}
```

`replaceUrl: true` replaces `/home/quick-view/:uuid` in the browser
history stack so pressing forward after the redirect does not return
to the broken quick-view URL.

`return` after navigate is mandatory — without it the rest of ngOnInit
runs against an empty queue and may cause runtime errors before the
navigation completes.

### 3. No other changes

Do not add a fallback UI block in the template.
Do not add a notification before redirecting.
Do not change `SessionQueueService`.
Do not change the route registration.

## Constraints
- Single file change only: `quick-view-container.component.ts`
- `replaceUrl: true` is mandatory
- `return` after `router.navigate` is mandatory
- Do not add any UI for the empty state — redirect is the entire handling

## Expected Output
1. `ng-frontend/src/app/features/quick-view/quick-view-container.component.ts`
   — empty queue guard added at top of ngOnInit

## Evaluation Checklist
- [ ] Open quick view normally — works as before
- [ ] Reload while on /home/quick-view/:uuid — redirects to /home
- [ ] After redirect, browser back does not return to quick-view URL
- [ ] No blank panel or console error appears before redirect completes
- [ ] Direct URL access to /home/quick-view/:uuid redirects to /home
- [ ] ng build passes with zero errors

## Log
### Run 1 — YYYY-MM-DD
Output:
Gap:
Action: