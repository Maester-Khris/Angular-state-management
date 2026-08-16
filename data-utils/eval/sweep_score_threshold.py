#!/usr/bin/env python3
"""Score-threshold calibration sweep for BAAI/bge-small-en-v1.5.

Sweeps score_threshold from 0.40 to 0.70 in 0.05 steps, runs the
golden query set through python-search-api's /search endpoint (plain
vector search, same embedding path as /search/ai's Qdrant leg), and
reports Precision@5 and the fraction of queries that returned fewer
than 5 results at each threshold.

Usage:
    cd data-utils
    doppler run -- python eval/sweep_score_threshold.py [--queries PATH] [--k 5]

Environment variables (injected by doppler or set manually):
    PYTHON_SEARCH_API_URL     e.g. http://localhost:5000
    NODE_SHARED_SECURITY_KEY  the shared internal API key

Output: a printed table. Pick the highest threshold where
short_result_rate stays below your acceptable floor (suggested: <0.20,
meaning at most 2 of 10 golden queries return fewer than k results).
"""

import argparse
import json
import os
import sys
import requests

THRESHOLDS = [round(t * 0.05, 2) for t in range(8, 15)]  # 0.40 to 0.70


def load_golden(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def search(base_url: str, key: str, query: str, limit: int, score_threshold: float) -> list[dict]:
    """Call /search with a score_threshold query param.
    /search doesn't natively support score_threshold yet — this script
    calls it as a stand-in for the Qdrant leg. After Task 2 ships, add
    score_threshold to the /search route's JSON body (or test directly
    against the service) and update this call accordingly.

    For now: call /search without threshold and filter client-side.
    This gives the same ranked list; we just discard results below the
    threshold to simulate the server-side filter.
    """
    resp = requests.post(
        f"{base_url}/search",
        json={"query": query, "limit": limit * 3},  # fetch more so filtering has headroom
        headers={"X-Internal-Key": key},
        timeout=15,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])
    # Client-side filter to simulate score_threshold until /search route exposes it
    filtered = [r for r in results if r.get("score", 0) >= score_threshold]
    return filtered[:limit]


def precision_at_k(retrieved_uuids: list[str], relevant_uuids: list[str], k: int) -> float:
    if not retrieved_uuids:
        return 0.0
    hits = sum(1 for uid in retrieved_uuids[:k] if uid in relevant_uuids)
    return hits / k


def run_sweep(golden: list[dict], base_url: str, key: str, k: int) -> None:
    print(f"\nSweeping score_threshold on {len(golden)} queries, k={k}")
    print(f"{'threshold':>12}  {'avg_precision':>14}  {'short_result_rate':>18}  {'queries_short':>14}")
    print("-" * 66)

    for threshold in THRESHOLDS:
        precisions = []
        short_count = 0

        for item in golden:
            query = item["query"]
            relevant = item.get("relevant_uuids", [])
            try:
                results = search(base_url, key, query, k, threshold)
            except Exception as e:
                print(f"  WARNING: query '{query}' failed at threshold {threshold}: {e}", file=sys.stderr)
                results = []

            retrieved_uuids = [r["uuid"] for r in results]
            precisions.append(precision_at_k(retrieved_uuids, relevant, k))
            if len(results) < k:
                short_count += 1

        avg_p = sum(precisions) / len(precisions) if precisions else 0.0
        short_rate = short_count / len(golden)
        print(f"{threshold:>12.2f}  {avg_p:>14.4f}  {short_rate:>18.4f}  {short_count:>14}/{len(golden)}")

    print()
    print("Decision guide:")
    print("  Pick the highest threshold where short_result_rate < 0.20")
    print("  Then set score_threshold=<chosen> in app.py _search_ai_pipeline calls")
    print("  Reference: life top-score=0.666, intelligence top-score=0.797 (30k corpus)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--queries", default="eval/golden_queries.json",
                        help="Path to golden queries JSON (default: eval/golden_queries.json)")
    parser.add_argument("--k", type=int, default=5, help="K for Precision@K (default: 5)")
    args = parser.parse_args()

    base_url = os.environ.get("PYTHON_SEARCH_API_URL", "http://localhost:5000")
    key = os.environ.get("NODE_SHARED_SECURITY_KEY", "")

    if not key:
        print("ERROR: NODE_SHARED_SECURITY_KEY not set", file=sys.stderr)
        sys.exit(1)

    golden_path = os.path.join(os.path.dirname(__file__), "..", "..", "python-search-api", args.queries)
    if not os.path.exists(golden_path):
        # Try relative to data-utils/eval/
        golden_path = args.queries
    if not os.path.exists(golden_path):
        print(f"ERROR: golden queries file not found: {args.queries}", file=sys.stderr)
        sys.exit(1)

    golden = load_golden(golden_path)
    run_sweep(golden, base_url, key, args.k)


if __name__ == "__main__":
    main()
