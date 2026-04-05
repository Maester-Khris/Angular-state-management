# Task: Refactor Home Layout to Google-Style Two-Column Rail

## Scope
- [ ] Restructure `home.component.html` outer layout from sidebar-competing to flex parent + independent rail
- [ ] Post grid fills all remaining space; rail never shrinks it
- [ ] `ai-results-panel` mounts/unmounts based on `withAi` — no empty box, no stretch
- [ ] Rail is `position: sticky` so it follows scroll alongside the grid
- [ ] All three states render correctly: results+AI, no-results+AI, no-AI
- [ ] No changes to `home.component.ts` business logic or streams
- [ ] No changes to `ai-results-panel` internal template or styles

## Role
Angular layout engineer. You are restructuring the CSS and HTML shell of an existing
component. Do not touch RxJS streams, data-fetching logic, or child component internals.
Read every file before editing — do not assume current class names or DOM structure.

## Context

### The problem with the current layout
The `ai-results-panel` (formerly `div.related-links-panel`) lives **inside** the same
flex/grid context as the post grid. When the panel has content it competes for horizontal
space and compresses the grid. When it has no content it leaves an empty column that
stretches. The root cause is that the panel is a sibling inside the grid's layout context
rather than a peer outside it.

### Target mental model (Google-style)
```