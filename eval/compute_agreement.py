# eval/compute_agreement.py
# Usage: python compute_agreement.py --a _pipeline/llm_judgments_a.json --b _pipeline/llm_judgments_b.json
#
# Computes per-query Jaccard overlap between the two independent judging passes and an overall
# average — the inter-annotator agreement metric the original 2-model process never computed.

import argparse
import json
import os

from _pipeline_log import log_stage


def load_judgments(path: str) -> dict[str, set[str]]:
    with open(path) as f:
        data = json.load(f)
    return {entry["query"]: set(entry["relevant_uuids"]) for entry in data}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def compute(a_path: str, b_path: str) -> dict:
    a = load_judgments(a_path)
    b = load_judgments(b_path)

    if a.keys() != b.keys():
        raise ValueError(f"Query set mismatch. Missing in B: {a.keys() - b.keys()}. Missing in A: {b.keys() - a.keys()}.")

    per_query = {}
    disagreements = []
    for query, a_set in a.items():
        b_set = b[query]
        per_query[query] = {
            "jaccard": round(jaccard(a_set, b_set), 3),
            "agreed": sorted(a_set & b_set),
            "a_only": sorted(a_set - b_set),
            "b_only": sorted(b_set - a_set),
        }
        for uuid in (a_set ^ b_set):
            disagreements.append({"query": query, "uuid": uuid, "pass_a": uuid in a_set, "pass_b": uuid in b_set})

    avg = sum(v["jaccard"] for v in per_query.values()) / len(per_query)
    return {"average_jaccard": round(avg, 3), "per_query": per_query, "disagreements": disagreements}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute inter-annotator agreement between judging passes A and B.")
    parser.add_argument("--a", required=True)
    parser.add_argument("--b", required=True)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "agreement_report.json"))
    args = parser.parse_args()

    report = compute(args.a, args.b)
    print(f"Average Jaccard agreement: {report['average_jaccard']}")
    print(f"Total disagreements: {len(report['disagreements'])}")

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Saved full report to {out_path}")
    log_stage("compute_agreement", input_count=40, output_count=40, errors=len(report["disagreements"]))
