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
from metrics import ndcg_at_k, precision_at_k, recall_at_k

FETCH_LIMIT = 10
K_PRECISION_RECALL = 5
K_NDCG = 10

DEFAULT_QUERIES = os.path.join(os.path.dirname(__file__), "..", "..", "eval", "golden_queries_30k.json")


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

        docs = search_posts_by_keyword(collection, query, FETCH_LIMIT)
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
    parser = argparse.ArgumentParser(description="Score the Mongo $text lexical leg alone against the 30k golden set.")
    parser.add_argument("--database", default="postair_eval")
    parser.add_argument("--collection", default="posts")
    parser.add_argument("--queries", default=DEFAULT_QUERIES)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    report = run(args.database, args.collection, load_queries(args.queries))
    output = json.dumps(report, indent=2)

    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Report written to {args.out}")
    print(json.dumps(report["summary"], indent=2))
