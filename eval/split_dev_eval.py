# eval/split_dev_eval.py
# Usage: python split_dev_eval.py [--in golden_queries_v2.json] [--types golden_queries_v2_types.json]
#
# Stratified dev/eval split -- carves off dev_fraction of each query TYPE (not a flat random
# split of the whole set) so both splits keep the same type mix. Dev is used only for
# hyperparameter tuning (score_threshold, RRF weights); eval is used only for reported ablation
# numbers -- see docs/superpowers/specs/2026-08-20-golden-set-rebuild-design.md section 6.

import argparse
import json
import os
import random
from collections import defaultdict

from _pipeline_log import log_stage


def stratified_split(queries: list[dict], types: dict[str, str], dev_fraction: float, seed: int) -> tuple[list[dict], list[dict]]:
    rng = random.Random(seed)
    by_type: dict[str, list[dict]] = defaultdict(list)
    for q in queries:
        by_type[types[q["query"]]].append(q)

    dev, ev = [], []
    for type_name, group in by_type.items():
        shuffled = group[:]
        rng.shuffle(shuffled)
        n_dev = round(len(shuffled) * dev_fraction)
        dev.extend(shuffled[:n_dev])
        ev.extend(shuffled[n_dev:])

    return dev, ev


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stratified dev/eval split of the v2 golden set.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "golden_queries_v2.json"))
    parser.add_argument("--types", default=os.path.join(os.path.dirname(__file__), "golden_queries_v2_types.json"))
    parser.add_argument("--dev-fraction", type=float, default=15 / 70)
    parser.add_argument("--seed", type=int, default=23)
    args = parser.parse_args()

    with open(args.in_path) as f:
        queries = json.load(f)
    with open(args.types) as f:
        types = json.load(f)

    dev, ev = stratified_split(queries, types, args.dev_fraction, args.seed)

    base = os.path.dirname(args.in_path)
    with open(os.path.join(base, "golden_queries_v2_dev.json"), "w", encoding="utf-8") as f:
        json.dump(dev, f, indent=2, ensure_ascii=False)
    with open(os.path.join(base, "golden_queries_v2_eval.json"), "w", encoding="utf-8") as f:
        json.dump(ev, f, indent=2, ensure_ascii=False)

    print(f"Split {len(queries)} queries -> {len(dev)} dev / {len(ev)} eval")
    log_stage("split_dev_eval", input_count=len(queries), output_count=len(dev) + len(ev), errors=0)
