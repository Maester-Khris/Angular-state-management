# Golden Query Relevance Map — 30k Corpus
**Generated:** 2026-08-15
**Corpus:** `postair_eval.posts` (Mongo, 30,000 posts) / `posts_eval` (Qdrant)
**Labeler:** two independent LLM judging passes + targeted human resolution
**Status:** ✅ FINALIZED — `eval/golden_queries_30k.json` (40 queries)

## Methodology

Consolidates findings from `artifacts/ai-search-upgrade/scalable-golden-set-research-2026-08-14.md`,
`artifacts/gemini_golden_set_building.md`, and the review of the original 10-query process. Full
design rationale: `artifacts/ai-search-upgrade/golden-query-set-30k-approach-2026-08-14.md`.

- **Query set:** 10 existing hand-authored queries (`eval/golden_queries.json`, reused as text
  only — deliberately covers ambiguous single-word edge cases) + 30 synthetic queries generated
  via Groq (Doc2Query-style — one query per stratified-sampled document, `eval/generate_synthetic_queries.py`)
  = 40 total.
- **Candidate pooling:** for each query, union of Qdrant vector search top-20 (`posts_eval`) and
  MongoDB text search top-20 (`postair_eval.posts`, text index created on `title`+`description`)
  — two independent retrieval methods, so judging isn't circular against the single system under
  evaluation. Synthetic queries additionally inject their source document directly (relevant by
  construction). `eval/build_candidate_pools.py`.
- **Judging pass A:** automated, Groq (`llama-3.3-70b-versatile`), scripted (`eval/judge_candidate_pools.py`),
  same relevance rubric as pass B, judged the pool blind (no access to pass B's output).
- **Judging pass B:** Gemini 3.1 Pro, relayed through the user (no Gemini API/tool in this
  project), judged the same pool blind (no access to pass A's output). Response parsed via
  `eval/parse_gemini_response.py`.
- **Relevance rubric (both passes):** *a candidate is relevant only if a user typing this exact
  query would be satisfied landing on it as a top result — a passing/tangential mention of a
  related concept is not enough.*
- **Inter-annotator agreement:** average Jaccard overlap across all 40 queries = **0.646**
  (`eval/compute_agreement.py`, full report in `eval/_pipeline/agreement_report.json`). Neither
  pass anchored on the other — first time this process has actually computed and recorded an
  agreement number.
- **Reconciliation:** intersection (both passes agreed) auto-confirmed as relevant for all 40
  queries. One exception: `intelligence` had **zero overlap** between the two passes (Pass A
  picked a weak/tangential match — "emotional intelligence in leadership"; Pass B picked 3
  genuinely on-topic AI/LLM docs) — resolved by a direct human call to use Pass B's 3 picks
  rather than leave the query with zero relevant docs. All other 73 disagreement items (out of
  74 total across 40 queries) were left unresolved by design — the user chose intersection-only
  as the default policy rather than reviewing each individually, given the volume.
- **Result:** 40/40 queries have ≥1 relevant doc. `relevant_uuids` count per query: min 1, max 3,
  avg 1.7 — lower than the original 10-query set's 3-5 target, an expected consequence of the
  strict intersection-only policy (conservative, not padded).

## Known data quality note

Roughly 3/30 synthetic queries surfaced from off-topic/spam content present in the raw Dev.to
scrape (`buy high quality beeswax`, `custom varsity jackets for sale`, `london mart noida extension`)
— stratified-by-hashtag sampling picked these up honestly; not a pipeline bug, just corpus
reality for a public scrape. Left in rather than filtered, since filtering wasn't in scope for
this pipeline and these queries still produced valid (if narrow) relevant-doc sets.

## Operational notes

- Groq's daily token limit (TPD, 100,000/day for `llama-3.3-70b-versatile`) was hit repeatedly
  during pass A — cumulative usage across the whole day's session work (harness runs, synthetic
  generation, judging attempts) saturated the budget, requiring multiple wait-and-resume cycles
  over several hours. `judge_candidate_pools.py` is resumable (incremental writes, skips
  already-judged queries) specifically because of this.
- Full pipeline audit trail: `eval/_pipeline/run_log.jsonl` (one line per stage, timestamps,
  input/output/error counts).

## Reference

- `eval/golden_queries_30k.json` — the final labeled set
- `eval/_pipeline/agreement_report.json` — full per-query agreement data
- `eval/_pipeline/candidate_pools.json` — the pools both passes judged
- `eval/_pipeline/llm_judgments_a.json`, `eval/_pipeline/llm_judgments_b.json` — raw per-pass judgments
