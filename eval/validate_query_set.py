# eval/validate_query_set.py
# Usage: python validate_query_set.py --in golden_queries_handauthored_v2.json
#
# Structural validation for hand-authored query batches -- checks type distribution, duplicate
# query text, and word-count sanity. Cannot validate query QUALITY (whether a "broad" query is
# genuinely broad) -- that's a human/LLM judgment call made during authoring, per the same
# rubric the original 10-query set used (eval/golden-query-relevance-map.md).

import argparse
import json

ALLOWED_TYPES = {"doc2query", "broad", "ambiguous", "hard_negative"}
MIN_WORDS, MAX_WORDS = 1, 6


def validate(entries: list[dict], expected_counts: dict[str, int]) -> list[str]:
    errors = []

    counts: dict[str, int] = {}
    seen_queries: set[str] = set()
    for entry in entries:
        q, t = entry["query"], entry["type"]
        if t not in ALLOWED_TYPES:
            errors.append(f"unexpected type {t!r} for query {q!r}")
        counts[t] = counts.get(t, 0) + 1
        if q in seen_queries:
            errors.append(f"duplicate query text: {q!r}")
        seen_queries.add(q)
        word_count = len(q.split())
        if not (MIN_WORDS <= word_count <= MAX_WORDS):
            errors.append(f"query {q!r} has word count {word_count}, expected {MIN_WORDS}-{MAX_WORDS}")

    for t, expected in expected_counts.items():
        actual = counts.get(t, 0)
        if actual != expected:
            errors.append(f"type {t!r}: expected {expected} queries, found {actual}")

    return errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate a hand-authored query batch.")
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--expect-broad", type=int, default=15)
    parser.add_argument("--expect-ambiguous", type=int, default=2)
    parser.add_argument("--expect-hard-negative", type=int, default=8)
    args = parser.parse_args()

    with open(args.in_path) as f:
        entries = json.load(f)

    errors = validate(entries, {"broad": args.expect_broad, "ambiguous": args.expect_ambiguous, "hard_negative": args.expect_hard_negative})
    if errors:
        print(f"{len(errors)} validation error(s):")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)
    print(f"OK: {len(entries)} queries valid.")
