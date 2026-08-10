# data-utils/eval/run_harness.py
# Usage: python run_harness.py --base-url http://localhost:5000 --internal-key <key> [--out report.json]
#
# Runs every query in golden_queries.json against the live /search/ai endpoint,
# scores expansion format-compliance (Precision/Recall need relevant_uuids filled
# in first — see golden_queries.json's note), and writes a report. Pure CLI,
# standalone, per data-utils convention.

import argparse
import json
import os
import sys

import requests

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics import format_compliant, precision_at_k, recall_at_k


def load_queries(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def run(base_url: str, internal_key: str, queries: list[dict], k: int = 5) -> dict:
    results = []
    for entry in queries:
        query = entry["query"]
        relevant = set(entry.get("relevant_uuids", []))

        resp = requests.post(
            f"{base_url}/search/ai",
            json={"query": query, "limit": k},
            headers={"X-Internal-Key": internal_key},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        retrieved = [doc["uuid"] for doc in data.get("similar_docs", [])]
        row = {
            "query": query,
            "expanded_query": data.get("expanded_query", ""),
            "format_compliant": format_compliant(data.get("expanded_query", "")),
        }
        if relevant:
            row["precision_at_k"] = precision_at_k(retrieved, relevant, k)
            row["recall_at_k"] = recall_at_k(retrieved, relevant, k)
        results.append(row)

    format_rate = sum(1 for r in results if r["format_compliant"]) / len(results)
    scored = [r for r in results if "precision_at_k" in r]
    summary = {
        "total_queries": len(results),
        "format_compliance_rate": round(format_rate, 4),
        "avg_precision_at_k": round(sum(r["precision_at_k"] for r in scored) / len(scored), 4) if scored else None,
        "avg_recall_at_k": round(sum(r["recall_at_k"] for r in scored) / len(scored), 4) if scored else None,
    }
    return {"summary": summary, "results": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the golden-query harness against /search/ai.")
    parser.add_argument("--base-url", default="http://localhost:5000")
    parser.add_argument("--internal-key", required=True)
    parser.add_argument("--queries", default=os.path.join(os.path.dirname(__file__), "golden_queries.json"))
    parser.add_argument("--out", default=None)
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()

    report = run(args.base_url, args.internal_key, load_queries(args.queries), k=args.k)
    output = json.dumps(report, indent=2)

    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Report written to {args.out}")
    print(json.dumps(report["summary"], indent=2))
