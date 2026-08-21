# eval/compute_agreement_v2.py
# Usage: python compute_agreement_v2.py --openai _pipeline_v2/llm_judgments_openai.json --claude _pipeline_v2/llm_judgments_claude.json
#
# v2 of eval/compute_agreement.py for graded judgments. Binarizes (grade >= 1 -> relevant) for
# Jaccard/disagreement purposes -- a full relevant/not-relevant mismatch goes to reconciliation,
# carrying whichever side's rationale exists so the reconsidering judge sees real information,
# not a blind re-ask. Separately tracks "grade conflicts" (both sides said relevant, disagreed
# only on 1 vs 2) -- these are NOT sent to reconciliation; final assembly resolves them by
# taking the higher grade.

import argparse
import json
import os

from _pipeline_log import log_stage


def binarize(judgments: list[dict]) -> set[str]:
    return {j["uuid"] for j in judgments}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def compute_from_dicts(a_by_query: dict, b_by_query: dict) -> dict:
    if a_by_query.keys() != b_by_query.keys():
        raise ValueError(f"Query set mismatch. Missing in B: {a_by_query.keys() - b_by_query.keys()}. "
                          f"Missing in A: {b_by_query.keys() - a_by_query.keys()}.")

    per_query = {}
    disagreements = []
    grade_conflicts = []

    for query, a_data in a_by_query.items():
        b_data = b_by_query[query]
        a_grades = {j["uuid"]: j for j in a_data["judgments"]}
        b_grades = {j["uuid"]: j for j in b_data["judgments"]}
        a_set, b_set = set(a_grades), set(b_grades)

        per_query[query] = {
            "jaccard": round(jaccard(a_set, b_set), 3),
            "agreed": sorted(a_set & b_set),
            "a_only": sorted(a_set - b_set),
            "b_only": sorted(b_set - a_set),
        }

        for uuid in a_set & b_set:
            if a_grades[uuid]["relevance"] != b_grades[uuid]["relevance"]:
                grade_conflicts.append({"query": query, "uuid": uuid, "a_grade": a_grades[uuid]["relevance"], "b_grade": b_grades[uuid]["relevance"]})

        for uuid in a_set ^ b_set:
            a_item = a_grades.get(uuid)
            b_item = b_grades.get(uuid)
            disagreements.append({
                "query": query, "uuid": uuid,
                "a_relevant": uuid in a_set, "b_relevant": uuid in b_set,
                "a_rationale": a_item["rationale"] if a_item else None,
                "b_rationale": b_item["rationale"] if b_item else None,
            })

    avg = sum(v["jaccard"] for v in per_query.values()) / len(per_query)
    return {"average_jaccard": round(avg, 3), "per_query": per_query, "disagreements": disagreements, "grade_conflicts": grade_conflicts}


def compute(openai_path: str, claude_path: str) -> dict:
    with open(openai_path) as f:
        a_by_query = {e["query"]: e for e in json.load(f)}
    with open(claude_path) as f:
        b_by_query = {e["query"]: e for e in json.load(f)}
    return compute_from_dicts(a_by_query, b_by_query)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute inter-annotator agreement for graded judgments (v2).")
    parser.add_argument("--openai", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "llm_judgments_openai.json"))
    parser.add_argument("--claude", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "llm_judgments_claude.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "agreement_report.json"))
    args = parser.parse_args()

    report = compute(args.openai, args.claude)
    print(f"Average Jaccard agreement: {report['average_jaccard']}")
    print(f"Relevance disagreements: {len(report['disagreements'])}, grade conflicts: {len(report['grade_conflicts'])}")

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Saved full report to {out_path}")
    log_stage("compute_agreement_v2", input_count=70, output_count=70, errors=len(report["disagreements"]))
