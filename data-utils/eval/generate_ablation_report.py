# data-utils/eval/generate_ablation_report.py
# Usage: python generate_ablation_report.py --lexical report_lexical_mongo.json
#        --bm25 report_bm25.json --semantic report_semantic.json --hybrid report_hybrid_rrf.json
#        [--out ablation_table.md]
#
# Renders the 4-column ablation table (Mongo $text / BM25 baseline / Qdrant semantic / RRF
# hybrid) in the same style as the Elastic Search Labs BM25/ELSER/RRF and Doug Turnbull
# BM25/KNN/RRF precedents cited in
# artifacts/ai-search-upgrade/hybrid-search-eval-methodology-research-2026-08-20.md -- same
# metric family (P@5, R@5, nDCG@10), one row per metric, one column per leg.

import argparse
import json

COLUMNS = [
    ("lexical", "Mongo $text"),
    ("bm25", "BM25 baseline"),
    ("semantic", "Qdrant semantic"),
    ("hybrid", "RRF hybrid"),
]

METRICS = [
    ("avg_precision_at_5", "Precision@5"),
    ("avg_recall_at_5", "Recall@5"),
    ("avg_ndcg_at_10", "nDCG@10"),
]


def load_report(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def render_table(reports: dict[str, dict]) -> str:
    total_queries = next(iter(reports.values()))["summary"]["total_queries"]
    header = "| Metric | " + " | ".join(label for _, label in COLUMNS) + " |"
    separator = "|---" * (len(COLUMNS) + 1) + "|"
    lines = [
        f"# Hybrid search eval -- ablation table ({total_queries} golden queries)",
        "",
        header,
        separator,
    ]
    for metric_key, metric_label in METRICS:
        row = [metric_label]
        for column_key, _ in COLUMNS:
            value = reports[column_key]["summary"][metric_key]
            row.append(f"{value:.4f}")
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render the 4-column ablation table from the four leg reports.")
    parser.add_argument("--lexical", required=True, help="Report from run_harness_lexical_mongo.py")
    parser.add_argument("--bm25", required=True, help="Report from build_bm25_baseline.py")
    parser.add_argument("--semantic", required=True, help="Report from run_harness_semantic.py")
    parser.add_argument("--hybrid", required=True, help="Report from run_harness_hybrid_rrf.py")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    reports = {
        "lexical": load_report(args.lexical),
        "bm25": load_report(args.bm25),
        "semantic": load_report(args.semantic),
        "hybrid": load_report(args.hybrid),
    }
    table = render_table(reports)

    if args.out:
        with open(args.out, "w") as f:
            f.write(table)
        print(f"Ablation table written to {args.out}")
    print(table)
