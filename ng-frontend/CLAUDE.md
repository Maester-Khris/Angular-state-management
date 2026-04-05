# Angular frontend

## Structure
src/app/
  core/          services, interceptors, guards
  features/      one folder per feature (home, post-detail, quick-view, ...)
  shared/        reusable components (post-card, search-bar, skeleton-card, ...)

## Conventions
- Standalone components only — no NgModule anywhere
- OnPush change detection on all components
- Signals for local state, vm$ RxJS pipe for home data orchestration
- Feature folder = component + html + scss + index.ts barrel

## Critical files
- src/app/app.routes.ts — full route tree, read before adding routes
- src/app/features/home/home.component.ts — vm$ stream, do not change shape
- src/app/core/session-queue.service.ts — reading session state

## Style
- Bootstrap utility classes + component-scoped SCSS
- CSS variables from platform: --bs-primary, glass card vars
- No inline [style] bindings for layout

## Build check
cd ng-frontend && ng build 2>&1 | tail -20