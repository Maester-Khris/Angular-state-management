# eval/build_claude_judging_handoff_v2.py
# Usage: python build_claude_judging_handoff_v2.py [--in _pipeline_v2/candidate_pools.json] [--out _pipeline_v2/claude_judging_handoff.md]
#
# Judging pass B (v2): formats candidate pools into a markdown package for a FRESH Claude
# conversation with no prior context -- deliberately excludes pass A's (OpenAI's) judgments so
# this stays a genuine independent opinion, same anchoring-avoidance principle as every prior
# handoff in this project.

import argparse
import json
import os

from _pipeline_log import log_stage

INSTRUCTIONS = """# Golden Query Relevance Judging (v2) — Independent Pass

For each query below, independently grade every genuinely relevant candidate: `1` = relevant (a
user typing this exact query would be satisfied landing on it as a top result), `2` = highly
relevant (a near-perfect match). A passing or tangential mention of a related concept is NOT
relevant — the document's core topic must match the query, not just share a keyword. There is no
limit on how many candidates you may grade, and no minimum — grade exactly as many as are
genuinely relevant, including zero.

Return your answer as one block per query, in this exact format:

```
QUERY: <query text>
RELEVANT: <uuid1>:<grade1>, <uuid2>:<grade2>, ...
```

Omit any candidate graded 0 — only list candidates you're grading 1 or 2. If none are relevant,
write `RELEVANT:` with nothing after it.

---

"""


def format_handoff(pools: list[dict]) -> str:
    lines = [INSTRUCTIONS]
    for i, pool in enumerate(pools, start=1):
        lines.append(f"## Query {i}: \"{pool['query']}\"\n")
        for c in pool["candidates"]:
            lines.append(f"- `{c['uuid']}` — **{c['title']}**: {c['description']}")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the Claude v2 independent-judging handoff package.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "candidate_pools.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "claude_judging_handoff.md"))
    args = parser.parse_args()

    with open(args.in_path) as f:
        pools = json.load(f)

    content = format_handoff(pools)
    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote handoff package for {len(pools)} queries to {out_path}")
    log_stage("build_claude_judging_handoff_v2", input_count=len(pools), output_count=len(pools), errors=0)
