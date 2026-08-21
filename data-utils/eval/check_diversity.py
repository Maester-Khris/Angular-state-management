# data-utils/eval/check_diversity.py
# Usage: python check_diversity.py --lexical report_v2_lexical.json --bm25 report_v2_bm25.json
#        --semantic report_v2_semantic.json --hybrid report_v2_hybrid.json [--out diversity_report.json]
#
# Closes eval/eval-protocol.md's Principle 9 gap for /api/search: checks whether the corpus-level
# duplicate/near-duplicate-title crowding documented for /search/ai's corpus (up to 22x-repeated
# posts, per eval/eval-history-2026-08-14-to-2026-08-21.md) actually shows up inside /api/search's
# real top-5 results, per leg, against the golden-set v2 eval split. Empirical (real retrieved
# titles), not a theoretical corpus-wide pre-check -- same connection pattern as lexical_mongo.py.

import argparse
import json
import os
import sys
from difflib import SequenceMatcher

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lexical_mongo import get_collection

TITLE_SIMILARITY_THRESHOLD = 0.7  # matches eval/flag_corpus_noise.py's calibrated threshold
TOP_K = 5


def load_report(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def hydrate_titles(collection, uuids: set[str]) -> dict[str, str]:
    docs = collection.find({"uuid": {"$in": list(uuids)}}, {"uuid": 1, "title": 1})
    return {d["uuid"]: d.get("title", "") for d in docs}


def find_duplicate_pairs(uuids: list[str], titles: dict[str, str]) -> list[tuple[str, str, float]]:
    """Pairs within a single top-K list whose titles are exact or near-duplicate (>= threshold)."""
    pairs = []
    for i in range(len(uuids)):
        for j in range(i + 1, len(uuids)):
            t1, t2 = titles.get(uuids[i], ""), titles.get(uuids[j], "")
            if not t1 or not t2:
                continue
            ratio = SequenceMatcher(None, t1.lower(), t2.lower()).ratio()
            if ratio >= TITLE_SIMILARITY_THRESHOLD:
                pairs.append((uuids[i], uuids[j], round(ratio, 3)))
    return pairs


def check_leg(report: dict, titles: dict[str, str]) -> dict:
    affected_queries = []
    for entry in report["results"]:
        top_k = entry["retrieved"][:TOP_K]
        pairs = find_duplicate_pairs(top_k, titles)
        if pairs:
            affected_queries.append({
                "query": entry["query"],
                "duplicate_pairs": [
                    {"uuid_a": a, "uuid_b": b, "title_a": titles.get(a, ""), "title_b": titles.get(b, ""), "similarity": r}
                    for a, b, r in pairs
                ],
            })
    total = len(report["results"])
    return {
        "total_queries": total,
        "queries_with_top5_duplicate": len(affected_queries),
        "pct_affected": round(len(affected_queries) / total, 4) if total else 0.0,
        "affected_queries": affected_queries,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check /api/search's top-5 results for duplicate/near-duplicate-title crowding (eval-protocol.md Principle 9).")
    parser.add_argument("--lexical", required=True)
    parser.add_argument("--bm25", required=True)
    parser.add_argument("--semantic", required=True)
    parser.add_argument("--hybrid", required=True)
    parser.add_argument("--database", default="postair_eval")
    parser.add_argument("--collection", default="posts")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    reports = {
        "lexical": load_report(args.lexical),
        "bm25": load_report(args.bm25),
        "semantic": load_report(args.semantic),
        "hybrid": load_report(args.hybrid),
    }

    all_uuids: set[str] = set()
    for report in reports.values():
        for entry in report["results"]:
            all_uuids.update(entry["retrieved"][:TOP_K])

    collection = get_collection(args.database, args.collection)
    titles = hydrate_titles(collection, all_uuids)
    print(f"Hydrated {len(titles)}/{len(all_uuids)} titles from {args.database}.{args.collection}")

    result = {leg: check_leg(report, titles) for leg, report in reports.items()}

    summary = {leg: {"queries_with_top5_duplicate": r["queries_with_top5_duplicate"], "total_queries": r["total_queries"], "pct_affected": r["pct_affected"]} for leg, r in result.items()}
    print(json.dumps(summary, indent=2))

    if args.out:
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Full report written to {args.out}")
