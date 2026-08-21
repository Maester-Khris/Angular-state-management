# eval/assemble_golden_set_v2.py
# Usage: python assemble_golden_set_v2.py
#
# Merges: (1) items both judges agreed were relevant (grade = max of the two grades, resolving
# Task 11's grade_conflicts), (2) round-2-resolved disagreements (grade = the reconsidering
# judge's original grade if they flipped to agree, else the never-changed side's grade), (3)
# round-3 tie-break verdicts. Writes both the harness-compatible golden_queries_v2.json and a
# separate type map for the dev/eval split.

import json
import os
import sys

from _pipeline_log import log_stage

BASE = os.path.dirname(__file__)

with open(os.path.join(BASE, "_pipeline_v2", "agreement_report.json")) as f:
    report = json.load(f)
with open(os.path.join(BASE, "_pipeline_v2", "llm_judgments_openai.json")) as f:
    openai_judgments = {e["query"]: {j["uuid"]: j["relevance"] for j in e["judgments"]} for e in json.load(f)}
with open(os.path.join(BASE, "_pipeline_v2", "llm_judgments_claude.json")) as f:
    claude_judgments = {e["query"]: {j["uuid"]: j["relevance"] for j in e["judgments"]} for e in json.load(f)}
with open(os.path.join(BASE, "_pipeline_v2", "reconciliation_openai_verdicts.json")) as f:
    openai_recon = {(v["query"], v["uuid"]): v["relevant"] for v in json.load(f)}
with open(os.path.join(BASE, "_pipeline_v2", "reconciliation_claude_verdicts.json")) as f:
    claude_recon = {(v["query"], v["uuid"]): v["relevant"] for v in json.load(f)}
with open(os.path.join(BASE, "_pipeline_v2", "tiebreak_verdicts.json")) as f:
    tiebreak = {(v["query"], v["uuid"]): v["relevant"] for v in json.load(f)}
with open(os.path.join(BASE, "_pipeline_v2", "query_manifest.json")) as f:
    manifest = json.load(f)

relevance_by_query: dict[str, dict[str, int]] = {q: {} for q in report["per_query"]}

for query, data in report["per_query"].items():
    for uuid in data["agreed"]:
        grade = max(openai_judgments[query].get(uuid, 1), claude_judgments[query].get(uuid, 1))
        relevance_by_query[query][uuid] = grade

for d in report["disagreements"]:
    key = (d["query"], d["uuid"])
    if d["a_relevant"] and not d["b_relevant"]:
        resolved_relevant = claude_recon.get(key)
        source_grade = openai_judgments[d["query"]].get(d["uuid"], 1)
    else:
        resolved_relevant = openai_recon.get(key)
        source_grade = claude_judgments[d["query"]].get(d["uuid"], 1)

    if resolved_relevant is True:
        relevance_by_query[d["query"]][d["uuid"]] = source_grade
    elif resolved_relevant is None:
        # not resolved in round 2 -> must be in the tie-break output
        tb = tiebreak.get(key)
        if tb is True:
            relevance_by_query[d["query"]][d["uuid"]] = source_grade
        elif tb is None:
            print(f"WARNING: no resolution found anywhere for {key} -- treating as not relevant", file=sys.stderr)

final = []
types_by_query = {e["query"]: e["type"] for e in manifest}
for query, relevance in relevance_by_query.items():
    final.append({"query": query, "relevant_uuids": sorted(relevance), "relevance": relevance})

empty = [f["query"] for f in final if not f["relevant_uuids"]]
if empty:
    print(f"NOTE: {len(empty)} quer(ies) have zero relevant docs (legitimate for hard-negative queries): {empty}")

out_path = os.path.join(BASE, "golden_queries_v2.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(final, f, indent=2, ensure_ascii=False)

types_out_path = os.path.join(BASE, "golden_queries_v2_types.json")
with open(types_out_path, "w", encoding="utf-8") as f:
    json.dump(types_by_query, f, indent=2, ensure_ascii=False)

print(f"Wrote {len(final)} queries to {out_path}")
log_stage("assemble_golden_set_v2", input_count=len(report["per_query"]), output_count=len(final), errors=len(empty))
