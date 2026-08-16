# eval/assemble_golden_set.py
# Usage: python assemble_golden_set.py
#
# Deterministically merges auto-agreed relevant docs (both judging passes confirmed) with the
# user's disagreement resolutions into the final golden query set. No manual JSON editing.

import json
import os
import sys

from _pipeline_log import log_stage

BASE = os.path.dirname(__file__)

with open(os.path.join(BASE, "_pipeline", "agreement_report.json")) as f:
    report = json.load(f)
with open(os.path.join(BASE, "_pipeline", "resolutions.json")) as f:
    resolutions = json.load(f)

resolved_relevant = {(r["query"], r["uuid"]) for r in resolutions if r["relevant"]}

final = []
for query, data in report["per_query"].items():
    relevant = set(data["agreed"])
    relevant |= {uuid for (q, uuid) in resolved_relevant if q == query}
    final.append({"query": query, "relevant_uuids": sorted(relevant)})

empty = [f["query"] for f in final if not f["relevant_uuids"]]
if empty:
    print(f"WARNING: {len(empty)} quer(ies) ended up with zero relevant docs: {empty}", file=sys.stderr)

out_path = os.path.join(BASE, "golden_queries_30k.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(final, f, indent=2, ensure_ascii=False)
print(f"Wrote {len(final)} queries to {out_path}")
log_stage("assemble_golden_set", input_count=len(report["per_query"]), output_count=len(final), errors=len(empty))
