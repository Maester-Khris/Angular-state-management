# eval/build_query_manifest_v2.py
# Usage: python build_query_manifest_v2.py
#
# Merges all three query sources into one manifest: the original 10 hand-authored queries
# (text reused as-is, tagged "ambiguous" -- they were all deliberately ambiguity-test queries
# per eval/golden-query-relevance-map.md), the 25 new hand-crafted queries (Task 6, already
# typed), and the 35 doc2query synthetic queries (Task 4, tagged "doc2query"). Validates the
# final 70-query, 4-type distribution before writing.

import json
import os
import sys

from _pipeline_log import log_stage
from validate_query_set import validate

BASE = os.path.dirname(__file__)
EXPECTED_COUNTS = {"doc2query": 35, "broad": 15, "ambiguous": 12, "hard_negative": 8}


def build_manifest() -> list[dict]:
    with open(os.path.join(BASE, "golden_queries.json")) as f:
        original_ambiguous = [{"query": e["query"], "type": "ambiguous", "seed_uuid": None} for e in json.load(f)]

    with open(os.path.join(BASE, "golden_queries_handauthored_v2.json")) as f:
        hand_authored = [{"query": e["query"], "type": e["type"], "seed_uuid": None} for e in json.load(f)]

    with open(os.path.join(BASE, "_pipeline_v2", "synthetic_queries_draft.json")) as f:
        doc2query = [{"query": e["query"], "type": "doc2query", "seed_uuid": e["seed_uuid"]} for e in json.load(f)]

    return original_ambiguous + hand_authored + doc2query


if __name__ == "__main__":
    manifest = build_manifest()

    errors = validate(manifest, EXPECTED_COUNTS)
    if errors:
        print(f"{len(errors)} validation error(s) in merged manifest:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    out_path = os.path.join(BASE, "_pipeline_v2", "query_manifest.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(manifest)} queries to {out_path}")
    log_stage("build_query_manifest_v2", input_count=len(manifest), output_count=len(manifest), errors=0)
