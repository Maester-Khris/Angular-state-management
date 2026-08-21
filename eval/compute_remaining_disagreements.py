# eval/compute_remaining_disagreements.py
# Usage: python compute_remaining_disagreements.py
#
# An item is resolved if round-2's reconsideration flipped to agree with the original relevant
# side. If it didn't flip, it's still disputed after 2 rounds and needs the tie-break round.

import json
import os

from _pipeline_log import log_stage

BASE = os.path.dirname(__file__)

with open(os.path.join(BASE, "_pipeline_v2", "agreement_report.json")) as f:
    report = json.load(f)
with open(os.path.join(BASE, "_pipeline_v2", "reconciliation_openai_verdicts.json")) as f:
    openai_verdicts = {(v["query"], v["uuid"]): v["relevant"] for v in json.load(f)}
with open(os.path.join(BASE, "_pipeline_v2", "reconciliation_claude_verdicts.json")) as f:
    claude_verdicts = {(v["query"], v["uuid"]): v["relevant"] for v in json.load(f)}

still_disputed = []
for d in report["disagreements"]:
    key = (d["query"], d["uuid"])
    if d["a_relevant"] and not d["b_relevant"]:  # Claude reconsidered
        if key in claude_verdicts and not claude_verdicts[key]:
            still_disputed.append(d)
    elif d["b_relevant"] and not d["a_relevant"]:  # OpenAI reconsidered
        if key in openai_verdicts and not openai_verdicts[key]:
            still_disputed.append(d)

out_path = os.path.join(BASE, "_pipeline_v2", "still_disputed.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(still_disputed, f, indent=2, ensure_ascii=False)
print(f"{len(still_disputed)}/{len(report['disagreements'])} items still disputed after round 2 -> {out_path}")
log_stage("compute_remaining_disagreements", input_count=len(report["disagreements"]), output_count=len(still_disputed), errors=0)
