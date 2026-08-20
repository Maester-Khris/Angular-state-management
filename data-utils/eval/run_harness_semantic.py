# data-utils/eval/run_harness_semantic.py
# Usage: python run_harness_semantic.py --base-url http://localhost:5000 --internal-key <key>
#        [--queries ../../eval/golden_queries_30k.json] [--out report.json]
#
# Measures the plain Qdrant semantic leg alone -- POST /search (python-search-api/app.py),
# NOT /search/ai. python-search-api MUST be running locally with
# QDRANT_COLLECTION_NAME=posts_eval for this run (start it via:
# cd python-search-api && QDRANT_COLLECTION_NAME=posts_eval doppler run -- python app.py --
# see python-search-api/CLAUDE.md for the base local-start command this overrides).

import argparse
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics import ndcg_at_k, precision_at_k, recall_at_k
from semantic_http import search_semantic

FETCH_LIMIT = 10
K_PRECISION_RECALL = 5
K_NDCG = 10

DEFAULT_QUERIES = os.path.join(os.path.dirname(__file__), "..", "..", "eval", "golden_queries_30k.json")


def load_queries(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def run(base_url: str, internal_key: str, queries: list[dict]) -> dict:
    results = []
    for entry in queries:
        query = entry["query"]
        relevant = set(entry.get("relevant_uuids", []))

        docs = search_semantic(base_url, internal_key, query, FETCH_LIMIT)
        retrieved = [doc["uuid"] for doc in docs]

        results.append({
            "query": query,
            "retrieved": retrieved,
            "precision_at_5": precision_at_k(retrieved, relevant, K_PRECISION_RECALL),
            "recall_at_5": recall_at_k(retrieved, relevant, K_PRECISION_RECALL),
            "ndcg_at_10": ndcg_at_k(retrieved, relevant, K_NDCG),
        })

    summary = {
        "total_queries": len(results),
        "avg_precision_at_5": round(sum(r["precision_at_5"] for r in results) / len(results), 4),
        "avg_recall_at_5": round(sum(r["recall_at_5"] for r in results) / len(results), 4),
        "avg_ndcg_at_10": round(sum(r["ndcg_at_10"] for r in results) / len(results), 4),
    }
    return {"summary": summary, "results": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score the plain Qdrant semantic leg alone against the 30k golden set.")
    parser.add_argument("--base-url", default="http://localhost:5000")
    parser.add_argument("--internal-key", required=True)
    parser.add_argument("--queries", default=DEFAULT_QUERIES)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    report = run(args.base_url, args.internal_key, load_queries(args.queries))
    output = json.dumps(report, indent=2)

    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Report written to {args.out}")
    print(json.dumps(report["summary"], indent=2))
