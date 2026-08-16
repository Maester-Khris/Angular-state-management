# eval/list_disagreements.py
# Usage: python list_disagreements.py
#
# Formats the agreement report's disagreements into a short, human-reviewable list (title
# included) — keeps the human spot-check step cheap: a short list, not full pool dumps.

import json
import os

BASE = os.path.dirname(__file__)

with open(os.path.join(BASE, "_pipeline", "agreement_report.json")) as f:
    report = json.load(f)
with open(os.path.join(BASE, "_pipeline", "candidate_pools.json")) as f:
    pools = json.load(f)

titles = {c["uuid"]: c["title"] for p in pools for c in p["candidates"]}

print(f"{len(report['disagreements'])} disagreement(s) to review:\n")
for i, d in enumerate(report["disagreements"], start=1):
    title = titles.get(d["uuid"], "<unknown>")
    print(f"{i}. Query: {d['query']!r}")
    print(f"   Doc: {title} ({d['uuid']})")
    print(f"   Pass A: {'relevant' if d['pass_a'] else 'not relevant'}, Pass B: {'relevant' if d['pass_b'] else 'not relevant'}")
    print()
