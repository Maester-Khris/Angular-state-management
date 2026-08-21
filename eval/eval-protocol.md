# Eval protocol — retrieval/ranking evaluation for `/api/search`

Governs retrieval/ranking evaluation going forward. Supersedes
`artifacts/ai-search-upgrade/evaluation-metrics-and-methodology.md` as the
authoritative source for endpoints in scope below — that file and
`artifacts/ai-search-upgrade/eval-history-2026-08-14-to-2026-08-21.md` stay
untouched as historical record; this doc doesn't rewrite history, it stops
being subordinate to it.

## Scope

**Covers retrieval/ranking evaluation only** — endpoints that return search
results without an intervening LLM-generation step. Currently: `/api/search`
(Mongo `$text` + Qdrant semantic + RRF fusion). Any future endpoint of the
same shape gets a new row in the Per-Endpoint Declared Parameters table
below, not a new document.

**`/search/ai` is explicitly out of scope.** It has an LLM-generation step
between retrieval and response (query expansion, Groq reranking, Exa
external-source synthesis) that P@k/R@k/nDCG/MRR/R-precision cannot
evaluate — that requires RAGAS-family metrics (Faithfulness, Context
Precision, Context Recall, Answer Relevance) judging generated output
against retrieved context, a genuinely different discipline. A RAGAS-based
protocol for `/search/ai` is future work, not designed here. Bundling it
into this protocol would repeat the exact scope-mismatch mistake found in
the original methodology doc.

## Standing Principles

1. Accuracy (set-based: P@k, R@k) and ranking-quality (rank-sensitive: MRR,
   nDCG, R-precision) are separate axes. Every eval reports both, never
   substitutes one for the other.
2. P@k/R@k have a structural per-query ceiling (`min(k,|relevant|)/k`).
   R-precision is mandatory alongside them specifically because it's
   ceiling-free — never report P@k/R@k without R-precision alongside.
3. Fusion is never evaluated alone — always reported next to its true input
   legs, same query set, same k. Any reference-only baseline (not an actual
   fusion input, e.g. BM25 against Mongo `$text`) must be labeled
   "(reference, not a fusion input)" inline in every table it appears in.
4. Candidate depth per leg must be stated explicitly as a deliberate,
   matched constant — not left implicit.
5. Metrics are reported per query-type stratum where the golden set has
   one, not only as a flat aggregate.
6. Relevance grading (graded 0/1/2, not binary) is required wherever nDCG
   is reported — nDCG degenerates toward a recall-like measure under
   binary relevance, so the two are adopted together, never separately.
7. Every reported metric carries a 95% bootstrap CI — not just the
   headline one. Any claim that one leg/system beats another must check
   whether their CIs overlap before calling the difference real.
8. k is derived from the real, verified consumption context of the
   specific endpoint being evaluated (product page size, scroll increment,
   panel size) — stated with its derivation (file:line or equivalent),
   never inherited from another endpoint or picked to match external
   benchmark precedent. If a metric family (e.g. nDCG) conventionally uses
   a different k than the product's own k, both are reported, both k's are
   labeled with which justification (product-consumption vs.
   benchmark-precedent) they use.
9. Diversity/redundancy (duplicate or near-duplicate crowding in top-k) is
   checked for every endpoint that queries a corpus known to have it — not
   only the endpoint where it was first discovered. A "checked, not
   applicable" note is sufficient; silence is not.

## Per-Endpoint Declared Parameters

Every in-scope endpoint's eval work fills in this table, checked against
the principles above.

| Field | `/api/search` |
|---|---|
| Consumption context | Scroll-loaded home feed (search branch) |
| k, with derivation | k=5, `ng-frontend/src/app/features/home/home.ts:37` |
| Candidate depth/leg | FETCH_LIMIT=10, matches `searchLimit` (`node-backend/routing/home.js:133`) |
| True fusion-input legs | Mongo `$text`, Qdrant semantic (`node-backend/services/rankprocessor.js`'s `mergeResults` signature) |
| Reference-only baselines | BM25 — must be labeled "(reference, not a fusion input)" per Principle 3 |
| Metrics reported | P@5, R@5, nDCG@10, MRR, R-precision |
| Grading scale | graded 0/1/2 (v2 golden set) |
| CI coverage | P@5 only currently — non-compliant with Principle 7, needs extending to all 4 other metrics |
| Diversity/redundancy | Never checked — same corpus has documented duplicate-title crowding (up to 22x-repeated posts) found via `/search/ai`'s investigation; Principle 9 requires at minimum a "checked, not applicable" note for `/api/search` too |

## Audit Closure

Maps each of the 9 systematic-debugging findings (2026-08-21 audit of the
project's eval-methodology documentation trail) to the principle/row that
now closes it.

| # | Finding | Closed by |
|---|---|---|
| 1 | Accuracy/ranking-axis distinction never stated as a standing principle | Principle 1 |
| 2 | P@k structural ceiling discovered empirically, not designed for | Principle 2 |
| 3 | BM25 presented as a peer "leg" in ablation tables, never flagged as reference-only | Principle 3 + declared-parameters row |
| 4 | Matched candidate depth achieved in practice but never stated as a deliberate precondition | Principle 4 + declared-parameters row |
| 5 | Query-type stratification only introduced in the v2 rebuild, absent before | Principle 5 |
| 6 | Graded relevance introduced but its causal link to nDCG's requirements never written down | Principle 6 |
| 7 | Bootstrap CI added late, inconsistently (1 of 5 metrics), never interpreted for significance | Principle 7 + declared-parameters row |
| 8 | Two unreconciled k values (5 for P@k/R@k, 10 for nDCG) coexisting silently | Principle 8 + declared-parameters row |
| 9 | MMR/diversity handling built for `/search/ai`, never even asked about for `/api/search` | Principle 9 + declared-parameters row |

## Revisit Trigger Checklist

Events that require revisiting this document — self-enforced via
discipline/PR self-review, no new tooling:

- A new retrieval-only endpoint enters eval scope → add its row to the
  Per-Endpoint Declared Parameters table
- A new metric is adopted, or an existing one dropped → update Standing
  Principles and the table together
- k or candidate depth changes for any endpoint → update that row,
  re-derive, re-cite
- Golden set is rebuilt or corpus changes → re-check every declared
  parameter, not just the ones that obviously relate
- A reference-only baseline is added → must be labeled per Principle 3
  immediately, not retrofitted later
- Any eval finding contradicts a declared parameter → fix the row
  same-session, don't leave it as a known-wrong placeholder
