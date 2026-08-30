# Golden Query Relevance Map — 30k Corpus
**Generated:** 2026-08-15, revised 2026-08-19
**Corpus:** `postair_eval.posts` (Mongo, 30,000 posts) / `posts_eval` (Qdrant)
**Labeler:** two independent LLM judging passes + disagreement adjudication (2 rounds) + targeted human resolution
**Status:** ✅ FINALIZED — `eval/golden_queries_30k.json` (36 queries)

## Methodology — original build

Consolidates findings from `artifacts/ai-search-upgrade/scalable-golden-set-research-2026-08-14.md`,
`artifacts/gemini_golden_set_building.md`, and the review of the original 10-query process. Full
design rationale: `artifacts/ai-search-upgrade/golden-query-set-30k-approach-2026-08-14.md`.

- **Query set:** 10 existing hand-authored queries (`eval/golden_queries.json`, reused as text
  only — deliberately covers ambiguous single-word edge cases) + 30 synthetic queries generated
  via Groq (Doc2Query-style — one query per stratified-sampled document, `eval/generate_synthetic_queries.py`)
  = 40 total originally, **36 after dropping 4 contaminated queries** (see below).
- **Candidate pooling:** for each query, union of Qdrant vector search top-20 (`posts_eval`) and
  MongoDB text search top-20 (`postair_eval.posts`, text index created on `title`+`description`)
  — two independent retrieval methods, so judging isn't circular against the single system under
  evaluation. Synthetic queries additionally inject their source document directly (relevant by
  construction). `eval/build_candidate_pools.py`.
- **Judging pass A:** automated, Groq, scripted (`eval/judge_candidate_pools.py`), same relevance
  rubric as pass B, judged the pool blind (no access to pass B's output).
- **Judging pass B:** Gemini 3.1 Pro, relayed through the user (no Gemini API/tool in this
  project), judged the same pool blind (no access to pass A's output). Response parsed via
  `eval/parse_gemini_response.py`.
- **Relevance rubric (all passes):** *a candidate is relevant only if a user typing this exact
  query would be satisfied landing on it as a top result — a passing/tangential mention of a
  related concept is not enough.*
- **Inter-annotator agreement (original build):** average Jaccard overlap across 40 queries =
  **0.646** (`eval/compute_agreement.py`, full report in `eval/_pipeline/agreement_report.json`).

## Reconciliation improvement pass (2026-08-19)

The original build's intersection-only reconciliation (auto-confirm only where both passes
agreed, leave all 74 disagreements unresolved rather than review them individually) was
identified as overly conservative — it was silently dropping true positives, not just noise.
`accessibility in tech` was the clearest case: all 5 of its disagreement items turned out
genuinely relevant on review, meaning the original process left a query with 5 valid candidates
stuck at `n_relevant=1`.

- **Disagreement adjudication, round 1:** Claude independently re-judged all 74 disagreement
  items against the same rubric (52 relevant, 22 not) — written to
  `eval/_pipeline/claude_disagreement_verdicts_full.json`. A second, independent Gemini pass
  (`eval/build_disagreement_handoff.py`, unlabeled — no anchoring on Claude's calls) judged the
  same 74 blind, returning only 30 relevant. 46 items agreed (27 relevant, 19 not); 28 disagreed
  — a *lower* agreement (0.622 Jaccard) than the original judging round, despite being a more
  curated, already-disputed subset.
- **Disagreement adjudication, round 2 (rationale requested):** the 28 still-disputed items were
  sent back to Gemini a second time (`eval/build_disagreement_rationale_handoff.py`), this time
  requiring a stated rationale per item — the round-1 terse yes/no format gave no way to
  sanity-check Gemini's calls. Two findings from the rationale:
  - **Verdict instability:** 3 items (`ai software developer trends` candidates) flipped from
    Gemini's own round-1 "relevant" to round-2 "not relevant" with no new information presented.
  - **A real rubric gap, not a genuine disagreement:** Gemini rejected all 3 `intelligence`
    AI/LLM candidates as "the query is ambiguous, cannot be guaranteed to mean AI" — but this
    product's own `expand_query` already commits to interpreting "intelligence" as AI/ML in this
    software-engineering context. Neither disagreement handoff had restated that domain-lock
    context, so Gemini judged the query in a vacuum. This is a process gap, not a real
    disagreement — resolved by keeping the original relevant call.
  - The remaining 25 items were rejected by Gemini under a consistently stricter-than-intended
    standard (`"not a guaranteed match"`, `"too narrow"`, `"too broad"` — effectively requiring
    exclusive/definitive topic match rather than "would satisfy a real user"). Judged
    over-strict for this purpose; resolved in favor of the original (Claude) relevant call.
  - **Final resolution for all 28 disagreements: Claude's original round-1 verdict** (25
    relevant, 3 not relevant) — see `eval/_pipeline/resolutions.json`.
- **Contaminated queries dropped (4 of 40):** `life`, `buy high quality beeswax`,
  `custom varsity jackets for sale`, `london mart noida extension`. Each query's only labeled
  relevant doc turned out to be off-domain content injected as "relevant by construction" from a
  synthetic query's own spam/off-topic seed document, never actually judged for domain fit.
  Reviewing each query's *full* disagreement set (not just its one original label) confirmed no
  rescuable on-topic content exists for these 4 in the pooled candidates — dropped rather than
  forced to a weaker replacement (per explicit decision: an unwinnable query only ever drags the
  average down).
- **Result after reconciliation:** 36 queries, `relevant_uuids` count per query: min 1, max 6,
  **avg 3.11** (up from 1.7). Structural ceiling for average Precision@5 rose from **0.335 to
  0.589**. Verified against live retrieval (candidate_limit=20-30): achieved avg Precision@5 rose
  from **0.245 to ~0.37**, avg Recall@5 moved from 0.796 to ~0.71-0.72 (expected — with 3.11
  avg relevant docs instead of 1.7, finding *all* of them in the top-5 is a genuinely harder bar
  than before, not a regression).

## Stage 2 — targeted re-pooling for still-sparse queries

12 queries remained at `n_relevant=1` after the reconciliation pass above (`hybrid integration
deployment`, `clickhouse cpu performance comparison`, `seo for new domains`, `openrgb not
working after sleep`, `hreflang seo guide`, `question answering on tables`, `kusk cloudentity
integration`, `google solution challenge 2025`, `whitebophir project contributions`, `fluxninja
rate limiting service`, `what is voice sdk`, `turbopack in next js`). To determine whether this
was a labeling-pool-depth limitation (fixable) or genuine corpus scarcity (not fixable by more
judging), their candidate pools were rebuilt at 2x depth (`pool_size` 20→40/leg, yielding
63-80 unique candidates vs. the original 26-40) and re-judged with pass A.

**Result: all 12 queries stayed at exactly `n_relevant=1` even with the wider pool.** This is a
clean, informative negative result — these are hyper-specific queries (e.g. `openrgb not
working after sleep`, `kusk cloudentity integration`) where the 30k corpus most likely does not
contain a second independent post covering the same narrow topic. Accepted as-is; Gemini pass B
on this batch was judged unlikely to change the outcome and skipped for these 12 specifically
(matches the two-pass rigor everywhere else in this process, deliberately relaxed only here
given the clean, consistent pass-A signal across all 12).

## Operational notes

- **Groq model migration mid-project:** `llama-3.3-70b-versatile` (used for the original build)
  was removed from Groq's catalog entirely on/before 2026-08-18 (confirmed via `GET
  /v1/models`). All judging from the reconciliation pass onward used its replacement,
  `openai/gpt-oss-120b` — a reasoning model, which required raising `MAX_TOKENS` in
  `judge_candidate_pools.py` twice (400→1500→4000) after observing empty-content failures caused
  by the model's hidden reasoning trace consuming the entire token budget before producing an
  answer, especially on the widest (70+ candidate) pools from Stage 2. One query
  (`seo for new domains`) additionally hit a `413 Payload Too Large` at `max_tokens=4000` on its
  73-candidate pool — resolved by trimming that specific call's candidate count rather than
  raising the token budget further.
- Groq's daily token limit (TPD) was hit repeatedly throughout — 100,000/day for the original
  model, 200,000/day for its replacement — requiring many wait-and-resume cycles.
  `judge_candidate_pools.py` is resumable (incremental writes, skips already-judged queries,
  fails fast on TPD instead of burning retries) specifically because of this.
- Full pipeline audit trail: `eval/_pipeline/run_log.jsonl` (one line per stage, timestamps,
  input/output/error counts).

## Reference

- `eval/golden_queries_30k.json` — the final labeled set (36 queries)
- `eval/_pipeline/agreement_report.json` — original-build per-query agreement data
- `eval/_pipeline/disagreement_reconciliation.json` — round-1 Claude/Gemini agree/disagree split
- `eval/_pipeline/claude_disagreement_verdicts_full.json` — Claude's disagreement adjudication with reasoning
- `artifacts/gemini_disagreement_judgments.md`, `artifacts/gemini_disagreement_rationale.md` — Gemini's two adjudication rounds
- `eval/_pipeline/candidate_pools.json`, `eval/_pipeline/stuck_candidate_pools.json` — the pools judged (original + Stage 2 wider pools)
- `eval/_pipeline/llm_judgments_a.json`, `eval/_pipeline/llm_judgments_b.json`, `eval/_pipeline/stuck_llm_judgments_a.json` — raw per-pass judgments
