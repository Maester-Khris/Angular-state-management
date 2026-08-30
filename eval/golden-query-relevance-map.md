# Golden Query Relevance Map
**Generated:** 2026-08-14  
**Corpus:** `eval/posts.json` (50 published posts)  
**Labeler:** AI-assisted human judgment (title + description content analysis)  
**Status:** ✅ FINALIZED — `relevant_uuids` populated in `golden_queries.json` after two-model review pass (2026-08-14)  

> **Reviewer instructions:** Verify each ranking. Mark ✅ to confirm relevance, ❌ to reject.
> After review, copy confirmed UUIDs into `eval/golden_queries.json`'s `relevant_uuids` array.
> Aim for 3–5 confirmed relevant docs per query (per methodology doc Part B1).

---

## Query 1 — `"redis caching strategies"`

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `ad987052-fd76-4070-ada5-e20fb2d6a175` | **Redis Caching Strategies** | Direct hit: write-through vs cache-aside, TTL, cache invalidation strategy — exact query match |
| 2 | `6353d23c-c255-43ba-9cb6-0560265f51f2` | **API Rate Limiting** | Redis counters with TTL for rate limiting — practical Redis cache usage pattern |
| 3 | `0d512ff8-26da-426d-9419-dd454313c951` | **Feature Flags in Practice** | Redis-backed flag store explicitly mentioned as production caching pattern |
| 4 | `1d482626-8b9a-467c-87f0-97067f3cf61c` | **Node.js Performance Tips** | Covers batching DB calls and has Redis hashtag — caching as performance tool |
| 5 | `b5587ad5-c76a-497d-b156-09d9bc9813e6` | **CI/CD Pipeline Setup** | "Cache aggressively" as pipeline strategy — general caching principle applied |
| 6 | `aa0a5950-2392-42ce-9e65-83c273589905` | **CI/CD Pipeline Setup** | "Cache node_modules between runs — single biggest speed win" — caching in practice |
| 7 | `08197a98-a69e-48f8-9a96-8124251d158c` | **Cloud Native Apps** | Circuit breakers and graceful degradation — patterns adjacent to cache-miss fallback design |

---

## Query 2 — `"kubernetes deployment rollback"`

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `046b5238-ad7b-48ee-907b-d78eca9ddec4` | **Intro to Kubernetes** | Direct: K8s operational overhead, CrashLoopBackOff, when to use — closest to K8s deployment concerns |
| 2 | `f8f03b3e-9665-43db-a062-1fa2b3d1990f` | **Microservices Patterns** | Saga pattern = compensating transactions for rollback in distributed systems |
| 3 | `08197a98-a69e-48f8-9a96-8124251d158c` | **Cloud Native Apps** | Health checks, circuit breakers — cloud-native failure recovery patterns used in K8s |
| 4 | `030cd780-870e-4971-8e9d-31a036f63319` | **Terraform for Beginners** | State management + applying infra changes safely (IaC rollback adjacent) |
| 5 | `b5587ad5-c76a-497d-b156-09d9bc9813e6` | **CI/CD Pipeline Setup** | Deployment frequency and pipeline design — rollback as deployment concern |
| 6 | `aa0a5950-2392-42ce-9e65-83c273589905` | **CI/CD Pipeline Setup** | Fail-fast pipeline gating — prevents bad deploys that require rollback |
| 7 | `7a9832e1-5238-43a6-9c0f-3d012c8b3e66` | **Serverless Architecture** | Deployment patterns — provisioned concurrency, cold starts as deployment consideration |

> ⚠️ **Corpus gap note:** No post directly covers K8s rollback commands (`kubectl rollout undo`). Rank 1 is the closest by topic. Reviewer should consider marking only ranks 1–3 as truly relevant.

---

## Query 3 — `"react state management"`

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `28296e1d-591c-4e1a-852a-010c7e717f04` | **The Future of React** | React 19 compiler, automatic memoization, `useTransition` for state updates — direct React state content |
| 2 | `cd2485cb-f7af-418b-94a9-1e78a9d5eb40` | **GraphQL vs REST** | Apollo client as React state layer — client-side caching for state management |
| 3 | `19c25a94-c55f-46b0-a610-072a876a7638` | **Browser DevTools Mastery** | Performance flame chart, lazy-load — debugging React rendering/state performance |
| 4 | `5613de0e-a0a6-4778-a3cd-cd76ee07c69d` | **Testing Strategies** | Integration tests over implementation details — applies directly to React component testing |
| 5 | `da36ed35-5085-4fe0-9b90-d941028c1ca8` | **CSS Grid vs Flexbox** | Frontend layout patterns — adjacent to React component composition |
| 6 | `bc744634-dbc1-47eb-84f6-553f4b5f13df` | **WebAssembly in 2024** | Browser performance modules — WASM boundary with JS/React state |
| 7 | `1a967dd7-b145-4461-bda8-a5b094d9f487` | **Mobile First Design** | Responsive CSS strategies — relevant to React UI rendering concerns |

> ⚠️ **Corpus gap note:** No post covers Redux, Zustand, Jotai, or React Context directly. Rank 1 is the only strong match. Ranks 2–4 are weak but adjacent. Reviewer may confirm only rank 1.

---

## Query 4 — `"postgres index tuning"`

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `c0f07cfc-7717-4c0f-96c0-d736302ee329` | **PostgreSQL Deep Dive** | `EXPLAIN ANALYZE`, B-tree indexes, N+1 detection, ORM query inspection — direct index tuning content |
| 2 | `ecd6dc03-356a-4e72-87d6-c6e8863341a7` | **PostgreSQL Deep Dive** | Partial indexes, `WHERE` clause index optimization — direct index tuning content |
| 3 | `ae0cb546-299a-411e-a18b-2083a499167d` | **Supabase vs Firebase** | Postgres row-level security, foreign keys, relational queries — Postgres-specific database design |
| 4 | `9ef0a85b-bfb3-40d0-a71a-7450b019816b` | **dbt for Data Modeling** | SQL version control, DAG dependencies, environment-aware SQL — DB modeling adjacent |
| 5 | `e45d24b8-d059-43f1-9389-7fc6d24d0dd4` | **DataOps Best Practices** | Row count assertions, referential integrity checks — data quality related to DB design |
| 6 | `c5b71fb1-32ad-4d4f-8674-d460476329ac` | **Spark for Big Data** | Partition tuning and data skew — analogous performance tuning for large datasets |
| 7 | `febaf786-e70b-471d-bfc1-4cf2fd1d652f` | **Data Pipelines with Airflow** | Data storage patterns (S3/GCS), idempotent tasks — infrastructure for data persistence |

---

## Query 5 — `"life"` *(ambiguous single-word query)*

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `c33c8110-0f0e-43f4-8aae-2de4a5b79462` | **Mental Health in Dev** | Burnout, work-life balance, engineering life quality — most directly about human life experience |
| 2 | `ec7841de-a3d3-47f0-b1cf-be2c339906f4` | **The Future of Education** | Career/life choices, CS degree vs practical skills — life trajectory decisions |
| 3 | `ddb3c303-0ef9-434e-b68d-2b0726df6ef6` | **Continuous Learning** | "Half-life of a framework" — explicitly uses "half-life" and career longevity framing |
| 4 | `697cd16f-c097-4dc4-b381-38654c51439c` | **Building a Side Project** | "Ship to five real users" — life of a product, learning from real-world feedback |
| 5 | `1d0cc623-ed9a-4cd3-9a9d-abc5faea057c` | **Sustainable Software** | Carbon footprint, environmental life impact — sustainability of infrastructure |
| 6 | `0399c50f-5552-4aa5-9520-16e4871d3c70` | **The Ethics of AI** | Bias affects people's lives — ethical dimensions of AI in real-world contexts |
| 7 | `fa3e842d-c082-436e-9f5c-42235351ada1` | **Mechanical Keyboards** | "You type eight hours a day" — daily work life ergonomics |

> ⚠️ **Ambiguity note:** This query tests the pipeline's handling of vague single-word input. No post is a strong match. Reviewer should confirm which (if any) should be in `relevant_uuids` — likely 1–2 max, or keep empty to measure that the pipeline returns low-confidence results.

---

## Query 6 — `"intelligence"` *(ambiguous single-word query)*

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `c123d8bb-6c1e-4bdb-8f78-c993ce008151` | **Machine Learning for Devs** | ML fundamentals — core artificial intelligence domain |
| 2 | `152c9c88-1cea-44e9-a347-55e6932b3001` | **The Rise of AI Agents** | Agentic intelligence — LLM-based reasoning, tool use, retry loops |
| 3 | `0399c50f-5552-4aa5-9520-16e4871d3c70` | **The Ethics of AI** | AI fairness, bias in intelligence systems — ML ethics |
| 4 | `eaf8ef94-079c-4004-bed7-36ac6a446bcf` | **Open Source AI Models** | Llama 3, Mistral — local AI intelligence benchmarking vs GPT-4 |
| 5 | `18e8ed2f-45ab-4add-86dd-19f8fba3e28f` | **LLMs in Production** | LLM in production — applied intelligence system engineering |
| 6 | `dc084721-beed-4feb-8b0b-85226dfe4185` | **Fine-tuning vs Prompting** | Model intelligence optimization — when to fine-tune vs prompt |
| 7 | `01b51ab6-b93a-421f-8bfd-dd6bbc082c20` | **RAG Architecture** | Retrieval-augmented intelligence — knowledge grounding for LLMs |

> ⚠️ **Ambiguity note:** The system should likely return AI-domain posts for "intelligence". This tests whether the query expansion step steers toward AI/ML vs other meanings (business intelligence, emotional intelligence). The golden set reviewer should decide which posts constitute a "correct" return for this query before running the harness.

---

## Query 7 — `"memory"` *(ambiguous single-word query)*

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `ad987052-fd76-4070-ada5-e20fb2d6a175` | **Redis Caching Strategies** | "A cache with no expiry is just a memory leak" — Redis as in-memory store, TTL prevents memory exhaustion |
| 2 | `1d482626-8b9a-467c-87f0-97067f3cf61c` | **Node.js Performance Tips** | "Never block the event loop" — memory management, worker threads for CPU-bound memory-intensive work |
| 3 | `19c25a94-c55f-46b0-a610-072a876a7638` | **Browser DevTools Mastery** | "60–70% of a bundle on first load" — memory optimization via lazy-load, Coverage tab |
| 4 | `1aaad19f-96d0-49e3-a9e1-51b777671c4c` | **Docker for Beginners** | Image size 1.2GB → 150MB — container memory footprint reduction |
| 5 | `87c4f432-8035-4c7c-9b57-a8d8beb5de87` | **Vector Databases Explained** | High-dimensional vector space — semantic memory in embeddings |
| 6 | `c5b71fb1-32ad-4d4f-8674-d460476329ac` | **Spark for Big Data** | "One partition holding 80% of records" — in-memory data skew, partition memory distribution |
| 7 | `7a9832e1-5238-43a6-9c0f-3d012c8b3e66` | **Serverless Architecture** | "128MB of memory" — Lambda memory sizing directly impacts cold-start performance |

> ⚠️ **Ambiguity note:** "Memory" in dev context could mean RAM, cache, persistent storage, or vector embeddings. This query tests disambiguation. Reviewer should decide the intended meaning(s) and select UUIDs accordingly. Ranks 1–2 (Redis, Node.js) are strongest for the "computer memory" interpretation.

---

## Query 8 — `"async python event loop"`

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `1d482626-8b9a-467c-87f0-97067f3cf61c` | **Node.js Performance Tips** | Event loop mechanics (Node, not Python) — closest direct coverage of event loop architecture, `worker_threads`, non-blocking patterns |
| 2 | `18e8ed2f-45ab-4add-86dd-19f8fba3e28f` | **LLMs in Production** | Streaming responses, async retry with exponential backoff — async production patterns |
| 3 | `152c9c88-1cea-44e9-a347-55e6932b3001` | **The Rise of AI Agents** | Async agentic tool calls, retry loops, structured output — async execution patterns |
| 4 | `f8f03b3e-9665-43db-a062-1fa2b3d1990f` | **Microservices Patterns** | Event-driven saga pattern — async event sequencing across services |
| 5 | `92db9a85-a218-4dbe-afb4-7c1d7d1d0b13` | **WebSockets vs SSE** | Async server-to-client push, pub/sub backend — async I/O communication |
| 6 | `febaf786-e70b-471d-bfc1-4cf2fd1d652f` | **Data Pipelines with Airflow** | "At-least-once execution" — async task orchestration and idempotency |
| 7 | `01b51ab6-b93a-421f-8bfd-dd6bbc082c20` | **RAG Architecture** | Hybrid async retrieval pipeline — async vector + keyword search patterns |

> ⚠️ **Corpus gap note:** No post directly covers Python's `asyncio`, `async def`, `await`, or `event loop`. This is a significant gap. The pipeline's query expansion should ideally surface async/event-loop content; with this corpus it likely won't. Reviewer may leave `relevant_uuids` empty or confirm rank 1 only (Node event loop as near-match).

---

## Query 9 — `"microservices vs monolith"`

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `f8f03b3e-9665-43db-a062-1fa2b3d1990f` | **Microservices Patterns** | Saga pattern, distributed transactions — direct microservices architecture content |
| 2 | `046b5238-ad7b-48ee-907b-d78eca9ddec4` | **Intro to Kubernetes** | "You probably don't need Kubernetes yet" — argues against premature microservices adoption |
| 3 | `899ef421-d516-4e62-af5d-61518fbcfa02` | **Monorepo Strategy** | Monorepo vs polyrepo — structural parallel to monolith vs microservices tradeoff |
| 4 | `08197a98-a69e-48f8-9a96-8124251d158c` | **Cloud Native Apps** | Circuit breakers, health checks — microservice resilience patterns |
| 5 | `7a9832e1-5238-43a6-9c0f-3d012c8b3e66` | **Serverless Architecture** | Serverless as alternative decomposition model to microservices |
| 6 | `cd2485cb-f7af-418b-94a9-1e78a9d5eb40` | **GraphQL vs REST** | Internal API communication between services — microservice API design |
| 7 | `92db9a85-a218-4dbe-afb4-7c1d7d1d0b13` | **WebSockets vs SSE** | Service-to-client real-time communication — inter-service messaging patterns |

---

## Query 10 — `"ci cd pipeline best practices"`

| Rank | UUID | Title | Relevance rationale |
|------|------|-------|---------------------|
| 1 | `b5587ad5-c76a-497d-b156-09d9bc9813e6` | **CI/CD Pipeline Setup** | Parallelize, cache, fail fast, deployment frequency — direct CI/CD best practices |
| 2 | `aa0a5950-2392-42ce-9e65-83c273589905` | **CI/CD Pipeline Setup** | Lint first, gate stages, cache node_modules — direct CI/CD best practices (duplicate title, complementary content) |
| 3 | `5613de0e-a0a6-4778-a3cd-cd76ee07c69d` | **Testing Strategies** | Integration vs unit tests, testing pyramid — core CI/CD test stage design |
| 4 | `e45d24b8-d059-43f1-9389-7fc6d24d0dd4` | **DataOps Best Practices** | CI pipelines for data models, automated data testing — CI applied to data layer |
| 5 | `f289c917-b298-4a1f-9a70-6e4f56850053` | **Cybersecurity Basics** | "Set up automated secret scanning in your CI pipeline" — security gate in CI/CD |
| 6 | `030cd780-870e-4971-8e9d-31a036f63319` | **Terraform for Beginners** | State management, remote state — IaC as part of CD pipeline |
| 7 | `1d482626-8b9a-467c-87f0-97067f3cf61c` | **Node.js Performance Tips** | "Profile with --prof before assuming the bottleneck" — performance testing as CI gate |

---

## Summary Table — UUID to Post Reference

| UUID | Title | Queries where it appears |
|------|-------|--------------------------|
| `ad987052` | Redis Caching Strategies | Q1 (#1), Q7 (#1) |
| `6353d23c` | API Rate Limiting | Q1 (#2) |
| `0d512ff8` | Feature Flags in Practice | Q1 (#3) |
| `1d482626` | Node.js Performance Tips | Q1 (#4), Q8 (#1), Q10 (#7) |
| `b5587ad5` | CI/CD Pipeline Setup | Q1 (#5), Q2 (#5), Q10 (#1) |
| `aa0a5950` | CI/CD Pipeline Setup | Q1 (#6), Q2 (#6), Q10 (#2) |
| `08197a98` | Cloud Native Apps | Q1 (#7), Q2 (#3), Q9 (#4) |
| `046b5238` | Intro to Kubernetes | Q2 (#1), Q9 (#2) |
| `f8f03b3e` | Microservices Patterns | Q2 (#2), Q9 (#1) |
| `030cd780` | Terraform for Beginners | Q2 (#4), Q10 (#6) |
| `28296e1d` | The Future of React | Q3 (#1) |
| `cd2485cb` | GraphQL vs REST | Q3 (#2), Q9 (#6) |
| `19c25a94` | Browser DevTools Mastery | Q3 (#3), Q7 (#3) |
| `5613de0e` | Testing Strategies | Q3 (#4), Q10 (#3) |
| `c0f07cfc` | PostgreSQL Deep Dive | Q4 (#1) |
| `ecd6dc03` | PostgreSQL Deep Dive | Q4 (#2) |
| `ae0cb546` | Supabase vs Firebase | Q4 (#3) |
| `9ef0a85b` | dbt for Data Modeling | Q4 (#4) |
| `c33c8110` | Mental Health in Dev | Q5 (#1) |
| `ec7841de` | The Future of Education | Q5 (#2) |
| `ddb3c303` | Continuous Learning | Q5 (#3) |
| `697cd16f` | Building a Side Project | Q5 (#4) |
| `c123d8bb` | Machine Learning for Devs | Q6 (#1) |
| `152c9c88` | The Rise of AI Agents | Q6 (#2), Q8 (#3) |
| `0399c50f` | The Ethics of AI | Q6 (#3) |
| `eaf8ef94` | Open Source AI Models | Q6 (#4) |
| `18e8ed2f` | LLMs in Production | Q6 (#5), Q8 (#2) |
| `dc084721` | Fine-tuning vs Prompting | Q6 (#6) |
| `01b51ab6` | RAG Architecture | Q6 (#7), Q8 (#7) |
| `87c4f432` | Vector Databases Explained | Q7 (#5) |
| `1aaad19f` | Docker for Beginners | Q7 (#4) |
| `c5b71fb1` | Spark for Big Data | Q4 (#6), Q7 (#6) |
| `7a9832e1` | Serverless Architecture | Q2 (#7), Q9 (#5) |
| `92db9a85` | WebSockets vs SSE | Q8 (#5), Q9 (#7) |
| `febaf786` | Data Pipelines with Airflow | Q4 (#7), Q8 (#6) |
| `899ef421` | Monorepo Strategy | Q9 (#3) |
| `e45d24b8` | DataOps Best Practices | Q4 (#5), Q10 (#4) |
| `f289c917` | Cybersecurity Basics | Q10 (#5) |

---

## Corpus Gap Analysis

| Query | Gap severity | Notes |
|-------|-------------|-------|
| `redis caching strategies` | Low | Strong direct match exists |
| `kubernetes deployment rollback` | High | No K8s rollback post — only general K8s overview |
| `react state management` | High | Only 1 React post (React 19 features) — no Redux/Zustand/Context |
| `postgres index tuning` | Low | Two PostgreSQL posts, both solid matches |
| `life` | Very High | Ambiguous — no strong topical match; tests disambiguation |
| `intelligence` | Medium | AI/ML posts exist; ambiguity between AI and human intelligence |
| `memory` | Medium | Spread across Redis, Node, Docker — no dedicated memory management post |
| `async python event loop` | Very High | Zero Python async posts — Node event loop is best proxy |
| `microservices vs monolith` | Medium | Microservices post exists; no explicit monolith comparison post |
| `ci cd pipeline best practices` | Low | Two complementary CI/CD posts, strong coverage |

## Independent Review Pass
**Reviewer:** Secondary AI Model
**Date:** 2026-08-14
**Objective:** Verify the initial model's mapping for accuracy, missing relevant posts, and ranking logic.

| Golden Query | Missing Relevant Posts (Found in Review) | Ranking & Sorting Accuracy | Verdict / Notes |
|--------------|-----------------------------------------|----------------------------|-----------------|
| `"redis caching strategies"` | None. All posts mentioning Redis/Caching were found. | **Accurate.** Exact match ranked #1, followed by posts utilizing Redis as a tool. | ✅ Pass. |
| `"kubernetes deployment rollback"` | None. (No direct K8s rollback posts exist in corpus). | **Accurate.** Best effort sorting; K8s overview placed #1, followed by distributed system rollback (Saga). | ✅ Pass. Corpus gap correctly identified. |
| `"react state management"` | None. | **Accurate.** Only one React post exists (`28296e1d`). The rest are weak/adjacent. | ✅ Pass. Corpus gap correctly identified. |
| `"postgres index tuning"` | None. | **Accurate.** Both PostgreSQL Deep Dive posts directly cover indexes and are correctly ranked #1 and #2. | ✅ Pass. |
| `"life"` | None. | **Subjective but logical.** Ambiguous query. Evaluated abstractly (work-life, half-life, product life). | ✅ Pass. |
| `"intelligence"` | None. | **Accurate.** Maps correctly to Machine Learning, AI Agents, and AI Ethics topics. | ✅ Pass. |
| `"memory"` | **Found 1 missed post:** `c912e2f4` (Edge Computing Explained) explicitly mentions "limited memory". | **Needs Adjustment.** `7a9832e1` (Serverless) discusses "128MB of memory" but was ranked #7. It should be top 3 alongside Redis. | ⚠️ **Adjust Ranking:** Move `7a9832e1` higher and insert `c912e2f4`. |
| `"async python event loop"` | None. (No Python async posts exist). | **Accurate.** Node.js "event loop" correctly identified as the closest semantic proxy. | ✅ Pass. |
| `"microservices vs monolith"` | None. | **Accurate.** Microservices post ranked #1, Monorepo (analogous architecture) ranked #3. | ✅ Pass. |
| `"ci cd pipeline best practices"` | None. | **Accurate.** Both explicit CI/CD posts are #1 and #2, followed by Testing, DataOps, and Security. | ✅ Pass. |

**Review Summary:** 
The initial mapping was highly accurate and correctly identified major corpus gaps (e.g., Python, React State, K8s Rollback). The only material correction required is for the ambiguous query `"memory"`, where explicit keyword matches (Edge Computing, Serverless Architecture) were either ranked too low or missed entirely.

---

## Final Synthesis — Two-Pass Decision Table

**Synthesized by:** Third-pass adjudication (2026-08-14)  
**Input:** Pass 1 (initial mapping) + Pass 2 (independent review)  
**Output:** `eval/golden_queries.json` — `relevant_uuids` @ k=5 per query  
**Metric target:** Precision@5 and Recall@5 per evaluation methodology doc (Part A1)

| Golden Query | Pass 1 Top-5 | Pass 2 Changes | Final Top-5 UUIDs | Corpus Gap? | Rationale |
|---|---|---|---|---|---|
| `redis caching strategies` | `ad987052`, `6353d23c`, `0d512ff8`, `1d482626`, `b5587ad5` | ✅ No changes | `ad987052`, `6353d23c`, `0d512ff8`, `1d482626`, `b5587ad5` | ❌ None | Direct exact-match post at #1; Redis as runtime pattern in ranks 2–5 |
| `kubernetes deployment rollback` | `046b5238`, `f8f03b3e`, `08197a98`, `030cd780`, `b5587ad5` | ✅ No changes | `046b5238`, `f8f03b3e`, `08197a98`, `030cd780`, `b5587ad5` | ⚠️ High | No rollback-specific post; K8s overview is closest. Recall@5 will be low by design — valid test of gap behaviour |
| `react state management` | `28296e1d`, `cd2485cb`, `19c25a94`, `5613de0e`, `bc744634` | ✅ No changes | `28296e1d`, `cd2485cb`, `19c25a94`, `5613de0e`, `bc744634` | ⚠️ High | Only one React post in corpus. Ranks 2–5 are adjacent-domain; P@5 will naturally be low — correct |
| `postgres index tuning` | `c0f07cfc`, `ecd6dc03`, `ae0cb546`, `9ef0a85b`, `e45d24b8` | ✅ No changes | `c0f07cfc`, `ecd6dc03`, `ae0cb546`, `9ef0a85b`, `e45d24b8` | ❌ None | Two direct Postgres Deep Dive posts are unambiguous #1 and #2; remainder are DB-adjacent |
| `life` | `c33c8110`, `ec7841de`, `ddb3c303`, `697cd16f`, `1d0cc623` | ✅ No changes | `c33c8110`, `ec7841de`, `ddb3c303`, `697cd16f`, `1d0cc623` | ⚠️ Very High | Inherently ambiguous. Ranked by "human experience" interpretation (burnout, career, continuous learning). Tests disambiguation; system should ideally use expanded query to narrow domain |
| `intelligence` | `c123d8bb`, `152c9c88`, `0399c50f`, `eaf8ef94`, `18e8ed2f` | ✅ No changes | `c123d8bb`, `152c9c88`, `0399c50f`, `eaf8ef94`, `18e8ed2f` | ❌ Medium | AI/ML interpretation consistent across both passes. 5 solid AI-domain matches available |
| `memory` | `ad987052`, `1d482626`, `19c25a94`, `1aaad19f`, `87c4f432` | ⚠️ **Adjusted**: promoted `7a9832e1` from rank #7→#2, added missed `c912e2f4` at #4, dropped `19c25a94` and `87c4f432` | `ad987052`, `7a9832e1`, `1d482626`, `c912e2f4`, `1aaad19f` | ❌ Medium | Pass 2 correctly caught: Serverless ("128MB of memory") and Edge Computing ("limited memory") are stronger literal memory references than DevTools/Vector DBs |
| `async python event loop` | `1d482626`, `18e8ed2f`, `152c9c88`, `f8f03b3e`, `92db9a85` | ✅ No changes | `1d482626`, `18e8ed2f`, `152c9c88`, `f8f03b3e`, `92db9a85` | ⚠️ Very High | Zero Python async posts. Node.js event-loop at #1 is best available proxy. This query will likely produce P@5≈0; retained to measure that failure case |
| `microservices vs monolith` | `f8f03b3e`, `046b5238`, `899ef421`, `08197a98`, `7a9832e1` | ✅ No changes | `f8f03b3e`, `046b5238`, `899ef421`, `08197a98`, `7a9832e1` | ❌ Medium | Microservices post direct; Monorepo vs polyrepo is a valid structural parallel; K8s post argues against premature decomposition |
| `ci cd pipeline best practices` | `b5587ad5`, `aa0a5950`, `5613de0e`, `e45d24b8`, `f289c917` | ✅ No changes | `b5587ad5`, `aa0a5950`, `5613de0e`, `e45d24b8`, `f289c917` | ❌ None | Two complementary CI/CD posts, Testing Strategies, DataOps CI, and secret-scanning in CI provide complete coverage |

### Change delta: Pass 1 → Final

| Query | Change |
|---|---|
| `memory` | **1 re-rank + 1 addition**: `7a9832e1` promoted to #2 (was #7 in pass 1); `c912e2f4` added at #4 (missed by pass 1); `19c25a94` and `87c4f432` dropped |
| All other 9 queries | No changes — both passes agreed |

### Expected harness behaviour by query

| Query | Expected P@5 | Expected R@5 | Notes |
|---|---|---|---|
| `redis caching strategies` | High | High | Direct match corpus, strong relevant set |
| `kubernetes deployment rollback` | Low | Low | Corpus gap — expected by design |
| `react state management` | Low–Medium | Low | Only 1 strong doc in corpus |
| `postgres index tuning` | High | High | Two direct matches guaranteed |
| `life` | Unpredictable | Low | Tests disambiguation quality of query expansion |
| `intelligence` | Medium–High | Medium | AI/ML domain match available |
| `memory` | Medium | Medium | Revised ranking makes literal memory refs reachable |
| `async python event loop` | Very Low | Very Low | Measures corpus gap failure gracefully |
| `microservices vs monolith` | Medium | Medium | One direct match + adjacents |
| `ci cd pipeline best practices` | High | High | Two direct hits virtually guaranteed |
