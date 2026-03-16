# Postair: Engineering the Modern Content Pipeline

> **By Engineers, For Engineers.** Postair is a polyglot, distributed architectural study designed to solve the complexities of real-time data synchronization, reactive state management, and AI-augmented search at scale.

Postair serves as an **Engineering Blog in codebase form**, documenting the trade-offs, failures, and optimizations involved in building production-grade full-stack systems.

---

## The Stack: Polyglot by Design

We chose a multi-runtime approach to leverage the specific strengths of different ecosystems:

| Layer | Technology |
|---|---|
| **Frontend** | Angular (Signals, Standalone) + RxJS for complex event orchestration |
| **Core Backend** | Node.js (Express) managing the "Source of Truth" and authentication |
| **Intelligence Layer** | Python-based Search API for Natural Language processing |
| **Data Pipeline** | Custom Python `data-utils` for unified seeding and schema normalization |
| **Data Layer** | MongoDB (documents), Qdrant (vector store), Upstash (Redis) |

---

## Technical Challenges & Engineering Logs

### 1. Intent-Aware Search (Query Expansion)

**Challenge:** Standard keyword matching often fails to capture user intent (e.g., searching "fast" should surface "quick" or "performance"). A purely lexical approach leaves semantic relevance on the table.

**Solution:** We built a multi-stage search pipeline that progressively enriches the query through three tiers:

- **Keyword Search:** A baseline BM25-style index provides fast, exact-match recall for deterministic queries.
- **Hybrid Search:** We combine keyword results with dense vector retrieval (via Qdrant) using a reciprocal rank fusion strategy, balancing lexical precision with semantic coverage.
- **AI-Augmented Search:** A lightweight LLM-driven pre-processor expands the user's raw search tokens before they hit the index. The model rewrites the query into semantically adjacent terms, and a web search layer enriches context for ambiguous or domain-specific inputs. The result is a significantly higher recall without sacrificing precision—surfacing relevant posts that share intent but not vocabulary.

---

### 2. High-Frequency State Synchronization

**Challenge:** Managing a "Global Feed" that must stay in sync with localized "User Activity" across disparate feature modules.

**Solution:** We moved away from traditional prop-drilling or monolithic stores. Instead, we architected a **Reactive Event Bus** using RxJS `Subject` streams. This allows for horizontal state broadcasting: when a post's visibility changes in a private module, the public feed reacts in $O(1)$ time without a full page re-fetch.

---

### 3. Infinite Scroll via Intersection Observer

**Challenge:** `scroll` event listeners are notorious for causing "Jank" and main-thread blocking.

**Solution:** We engineered a shared **Intersection Observer Directive**. By offloading visibility detection to the browser's native API, we trigger the "Next Page" stream only when necessary, maintaining a constant 60fps even with 1,000+ DOM nodes.

---

## Reader Experience Features

Beyond the engineering internals, Postair ships a set of reader-first UI patterns designed for focused, distraction-free content consumption:

| Feature | Description | Status |
|---|---|---|
| **Quick Post Overview** | Vertical swipe gesture to scan post summaries without leaving the feed | Coming Soon |
| **Focused Reading Mode** | Post detail view with a blurred background to eliminate visual noise and center attention on content | Available |

---

## Project Structure (Architectural Audit)

```plaintext
.
├── ng-frontend          # Reactive UI (Signals, RxJS, DDD approach)
├── node-backend         # Core Business Logic & Auth Middleware
├── python-search-api    # AI Intelligence & Query Expansion logic
└── data-utils           # Data Pipeline (Seeding, JSON-to-Document/Vector normalization)
```

---

## Call for Contributors

Postair is an open-source **"Engineering Lab."** We are looking for engineers who are passionate about **architecture** rather than just "features." We welcome contributions in the following areas:

- **Infrastructure:** Containerizing the polyglot services for Kubernetes.
- **Performance:** Benchmarking the Node.js analytics middleware under stress.
- **Search:** Improving the Python query expansion with vector embeddings (FAISS/Chroma).
- **Observability:** Implementing OpenTelemetry for cross-service tracing.

---

## Getting Started

### Prerequisites

- Node.js (v18+) | Python (3.10+) | Angular CLI

### Steps

1. **Environment Setup:** Run `local.entry.sh` to initialize the localized development environment.
2. **Data Ingestion:** Use the `data-utils` seeder to populate the initial "Seed" state.
3. **Frontend:** `cd ng-frontend && npm start`
```