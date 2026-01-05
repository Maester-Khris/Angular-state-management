# Reactive Angular Architecture: The Lethal Post Manager

A high-performance, production-grade Angular application demonstrating **Unidirectional Data Flow**, **Reactive State Management**, and **Senior-level Architecture Patterns**. 

This project serves as a showcase for modern Angular (Standalone, Signals) and advanced RxJS techniques, moving beyond basic CRUD to solve complex synchronization and performance challenges.



## Key Features

* **Reactive Global Search:** Implementation of the "Search Stream" pattern using RxJS (`debounceTime`, `distinctUntilChanged`, `switchMap`) to eliminate race conditions and redundant API calls.
* **Encapsulated Feature State:** Utilization of **NgRx ComponentStore** for localized state management, keeping components "lean" and business logic testable.
* **Optimistic UI Updates:** Advanced state handling for deletions and updates, providing instant user feedback with automatic background rollback on server failure.
* **Cross-Feature Synchronization:** A reactive global event bus ensuring that the "Public Home Feed" stays in sync with private "User Activity" changes without page reloads.
* **Smart vs. Dumb Component Strategy:** Clean separation of concerns with a shared UI library and domain-specific feature modules.

---

## 🛠 Technical Challenges & Solutions

### 1. The Race Condition Trap
**Challenge:** Users typing rapidly in the search bar triggering multiple overlapping HTTP requests.
**Solution:** Implemented a reactive pipeline that flattens triggers into a single stream, using `switchMap` to cancel previous pending requests and `startWith` to ensure an immediate initial load.

### 2. State Syncing across Islands
**Challenge:** How to update a "Home" feed when a post is marked "Public" in a completely different feature module.
**Solution:** Architected a **Reactive Global Trigger** inside the Core API service. This allows features to broadcast state changes horizontally without tight coupling.

### 3. Injection Context & Signal Interop
**Challenge:** Modernizing the app with Signals while maintaining the power of RxJS Effects.
**Solution:** Structured the dependency injection to handle `toObservable` and `toSignal` within proper life-cycle hooks, ensuring "glitch-free" reactivity between the Store and the View.

---

## Architecture Overview

The project follows a **Domain-Driven Design (DDD)** folder structure:

* **`core/`**: Singletons, global guards, and the "Source of Truth" services.
* **`features/`**: Lazy-loadable modules containing domain-specific logic and their own `data-access` (Stores).
* **`shared/`**: Presentational UI components and logic-free directives/pipes.
* **`data-access/`**: (Future) Global NgRx store for high-level application state.



---

## Installation & Execution

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0 or higher)
* [Angular CLI](https://angular.io/cli) (`npm install -g @angular/cli`)

### 1. Clone the repository
```bash
git clone [https://github.com/your-username/lethal-angular-posts.git](https://github.com/your-username/lethal-angular-posts.git)
cd lethal-angular-posts