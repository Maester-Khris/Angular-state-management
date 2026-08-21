"""Pure scoring functions for the AI-search golden-query harness.
No I/O, no side effects — kept separate from run_harness.py so they're
independently unit-testable (per evaluation-metrics-and-methodology.md Part A1/A2)."""

import math
import re


def precision_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    top_k = retrieved[:k]
    if not top_k:
        return 0.0
    hits = sum(1 for item in top_k if item in relevant)
    return hits / len(top_k)


def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    if not relevant:
        return 0.0
    top_k = set(retrieved[:k])
    hits = len(top_k & relevant)
    return hits / len(relevant)


def ndcg_at_k(retrieved: list[str], relevance: dict[str, int], k: int) -> float:
    """Graded nDCG@k (Jarvelin & Kekalainen gain function: 2^rel - 1).
    DCG@k  = sum_{i=1}^{k} (2^rel_i - 1) / log2(i+1)   (i is the 1-indexed rank, rel_i in {0,1,2})
    IDCG@k = DCG of the ideal ranking (highest-grade docs first, capped at k)
    Returns 0.0 when there are no relevant docs (IDCG would be 0, undefined)."""
    if not relevance:
        return 0.0
    top_k = retrieved[:k]
    dcg = sum(
        (2 ** relevance.get(doc_id, 0) - 1) / math.log2(i + 2)
        for i, doc_id in enumerate(top_k)
    )
    ideal_grades = sorted(relevance.values(), reverse=True)[:k]
    idcg = sum((2 ** grade - 1) / math.log2(i + 2) for i, grade in enumerate(ideal_grades))
    return dcg / idcg if idcg > 0 else 0.0


def mrr(retrieved: list[str], relevant: set[str]) -> float:
    """Mean Reciprocal Rank for a single query: 1/rank of the first relevant hit, 0 if none."""
    for i, doc_id in enumerate(retrieved):
        if doc_id in relevant:
            return 1.0 / (i + 1)
    return 0.0


def r_precision(retrieved: list[str], relevant: set[str]) -> float:
    """Precision at rank R, where R = number of relevant docs for this query, capped at 10
    (FETCH_LIMIT) -- avoids the fixed-k=5 assumption while guaranteeing R never exceeds what's
    actually fetched. Without the cap, queries with >10 relevant docs silently degenerate into
    precision@10 anyway (precision_at_k's denominator is len(top_k), not r), making the metric
    misleadingly report "R-precision" when it measured precision@10. Capping r directly makes
    that the honest, intended behavior instead of a silent side effect."""
    r = min(len(relevant), 10)
    if r == 0:
        return 0.0
    return precision_at_k(retrieved, relevant, r)


_PUNCTUATION_RE = re.compile(r"[.,;:!?\"']")


def format_compliant(expanded: str, max_keywords: int = 8) -> bool:
    """Matches inference.py's expand_query contract: space-separated keywords,
    no punctuation, at most max_keywords tokens."""
    if not expanded or not expanded.strip():
        return False
    if _PUNCTUATION_RE.search(expanded):
        return False
    keyword_count = len(expanded.split())
    return keyword_count <= max_keywords
