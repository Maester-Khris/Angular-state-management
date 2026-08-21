# data-utils/eval/generate_ablation_report.py
# Usage: python generate_ablation_report.py --lexical report_lexical_mongo.json
#        --bm25 report_bm25.json --semantic report_semantic.json --hybrid report_hybrid_rrf.json
#        [--out ablation_table.md]
#
# Renders the 4-column ablation table (Mongo $text / BM25 baseline / Qdrant semantic / RRF
# hybrid) in the same style as the Elastic Search Labs BM25/ELSER/RRF and Doug Turnbull
# BM25/KNN/RRF precedents cited in
# artifacts/ai-search-upgrade/hybrid-search-eval-methodology-research-2026-08-20.md -- same
# metric family (P@5, R@5, nDCG@10, MRR, R-precision), one row per metric, one column per leg.
# v2: adds a bootstrap 95% CI per cell and a per-query-type breakdown table.

import argparse
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from eval_stats import bootstrap_ci

COLUMNS = [
    ("lexical", "Mongo $text"),
    ("bm25", "BM25 baseline"),
    ("semantic", "Qdrant semantic"),
    ("hybrid", "RRF hybrid"),
]

METRICS = [
    ("precision_at_5", "Precision@5"),
    ("recall_at_5", "Recall@5"),
    ("ndcg_at_10", "nDCG@10"),
    ("mrr", "MRR"),
    ("r_precision", "R-precision"),
]


def load_report(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def render_table(reports: dict[str, dict]) -> str:
    total_queries = next(iter(reports.values()))["summary"]["total_queries"]
    header = "| Metric | " + " | ".join(label for _, label in COLUMNS) + " |"
    separator = "|---" * (len(COLUMNS) + 1) + "|"
    lines = [
        f"# Hybrid search eval -- ablation table v2 ({total_queries} eval-split golden queries)",
        "",
        header,
        separator,
    ]
    for metric_key, metric_label in METRICS:
        row = [metric_label]
        for column_key, _ in COLUMNS:
            per_query_values = [r[metric_key] for r in reports[column_key]["results"]]
            mean, lo, hi = bootstrap_ci(per_query_values, n_resamples=1000, seed=0)
            row.append(f"{mean:.4f} [{lo:.4f}, {hi:.4f}]")
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines) + "\n"


def render_type_breakdown(reports: dict[str, dict], types_path: str) -> str:
    with open(types_path) as f:
        types_by_query = json.load(f)

    lines = ["", "## Precision@5 by query type", ""]
    header = "| Type | " + " | ".join(label for _, label in COLUMNS) + " |"
    separator = "|---" * (len(COLUMNS) + 1) + "|"
    lines += [header, separator]

    type_names = sorted(set(types_by_query.values()))
    for type_name in type_names:
        row = [type_name]
        for column_key, _ in COLUMNS:
            values = [r["precision_at_5"] for r in reports[column_key]["results"] if types_by_query.get(r["query"]) == type_name]
            mean = sum(values) / len(values) if values else 0.0
            row.append(f"{mean:.4f} (n={len(values)})")
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render the 4-column ablation table (v2, with CIs and type breakdown).")
    parser.add_argument("--lexical", required=True, help="Report from run_harness_lexical_mongo.py")
    parser.add_argument("--bm25", required=True, help="Report from build_bm25_baseline.py")
    parser.add_argument("--semantic", required=True, help="Report from run_harness_semantic.py")
    parser.add_argument("--hybrid", required=True, help="Report from run_harness_hybrid_rrf.py")
    parser.add_argument("--types", default=os.path.join(os.path.dirname(__file__), "..", "..", "eval", "golden_queries_v2_types.json"))
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    reports = {
        "lexical": load_report(args.lexical),
        "bm25": load_report(args.bm25),
        "semantic": load_report(args.semantic),
        "hybrid": load_report(args.hybrid),
    }
    table = render_table(reports) + render_type_breakdown(reports, args.types)

    if args.out:
        with open(args.out, "w") as f:
            f.write(table)
        print(f"Ablation table written to {args.out}")
    print(table)
