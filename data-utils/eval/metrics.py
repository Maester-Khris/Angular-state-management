"""Pure scoring functions for the AI-search golden-query harness.
No I/O, no side effects — kept separate from run_harness.py so they're
independently unit-testable (per evaluation-metrics-and-methodology.md Part A1/A2)."""

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
