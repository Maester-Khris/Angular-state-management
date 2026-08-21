# data-utils/eval/run_harness_lexical_mongo.py
# Usage: doppler run -- python run_harness_lexical_mongo.py [--database postair_eval]
#        [--collection posts] [--queries ../../eval/golden_queries_30k.json] [--out report.json]
#
# Measures the Mongo $text lexical leg of GET /api/search in isolation -- direct pymongo
# against postair_eval, no node-backend call. Requires MONGO_USERNAME/MONGO_PASSWORD in
# environment (same as eval/load_mongo_eval.py -- run via `doppler run --`).

import argparse
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lexical_mongo import ensure_text_index, get_collection, search_posts_by_keyword
from metrics import mrr, ndcg_at_k, precision_at_k, r_precision, recall_at_k

FETCH_LIMIT = 10
K_PRECISION_RECALL = 5
K_NDCG = 10


def load_queries(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def run(database: str, collection_name: str, queries: list[dict]) -> dict:
    collection = get_collection(database, collection_name)
    ensure_text_index(collection)

    results = []
    for entry in queries:
        query = entry["query"]
        relevant = set(entry.get("relevant_uuids", []))
        relevance = {k: int(v) for k, v in entry.get("relevance", {}).items()}

        docs = search_posts_by_keyword(collection, query, FETCH_LIMIT)
        retrieved = [doc["uuid"] for doc in docs]

        results.append({
            "query": query,
            "retrieved": retrieved,
            "precision_at_5": precision_at_k(retrieved, relevant, K_PRECISION_RECALL),
            "recall_at_5": recall_at_k(retrieved, relevant, K_PRECISION_RECALL),
            "ndcg_at_10": ndcg_at_k(retrieved, relevance, K_NDCG),
            "mrr": mrr(retrieved, relevant),
            "r_precision": r_precision(retrieved, relevant),
        })

    summary = {
        "total_queries": len(results),
        "avg_precision_at_5": round(sum(r["precision_at_5"] for r in results) / len(results), 4),
        "avg_recall_at_5": round(sum(r["recall_at_5"] for r in results) / len(results), 4),
        "avg_ndcg_at_10": round(sum(r["ndcg_at_10"] for r in results) / len(results), 4),
        "avg_mrr": round(sum(r["mrr"] for r in results) / len(results), 4),
        "avg_r_precision": round(sum(r["r_precision"] for r in results) / len(results), 4),
    }
    return {"summary": summary, "results": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score the Mongo $text lexical leg alone against the v2 golden set.")
    parser.add_argument("--database", default="postair_eval")
    parser.add_argument("--collection", default="posts")
    parser.add_argument("--split", choices=["dev", "eval"], help="Use eval/golden_queries_v2_<split>.json")
    parser.add_argument("--queries", default=None, help="Explicit query file path (overrides --split; for ad-hoc checks only)")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    if not args.queries:
        if not args.split:
            print("ERROR: pass --split dev|eval, or --queries for an explicit ad-hoc override.", file=sys.stderr)
            sys.exit(1)
        args.queries = os.path.join(os.path.dirname(__file__), "..", "..", "eval", f"golden_queries_v2_{args.split}.json")

    report = run(args.database, args.collection, load_queries(args.queries))
    output = json.dumps(report, indent=2)

    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Report written to {args.out}")
    print(json.dumps(report["summary"], indent=2))
