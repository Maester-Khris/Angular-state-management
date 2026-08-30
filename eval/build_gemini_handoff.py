# eval/build_gemini_handoff.py
# Usage: python build_gemini_handoff.py [--in _pipeline/candidate_pools.json] [--out _pipeline/gemini_handoff.md]
#
# Formats the candidate pools into a clean markdown package for judging pass B (Gemini, no
# API/tool available in this project — relayed through the user). Deliberately excludes pass
# A's judgments so Gemini's pass is a genuine independent opinion, not verification of pass A's
# picks (the exact anchoring-bias gap found in the original 2-model process).

import argparse
import json
import os

from _pipeline_log import log_stage

INSTRUCTIONS = """# Golden Query Relevance Judging — Independent Pass

For each query below, independently select the 3-5 most relevant documents from its candidate
list. A document counts as relevant only if a user typing this exact query would be satisfied
landing on it as a top result — a passing/tangential mention of a related concept is NOT
enough (e.g. a CI/CD post that mentions "cache aggressively" in passing is NOT relevant to a
caching-strategies query@ unless caching is a central topic of that post).

Return your answer as one line per query, in this exact format:

```
QUERY: <query text>
RELEVANT: <uuid1>, <uuid2>, <uuid3>
```

One RELEVANT line per query, using the exact UUIDs shown below. If fewer than 3 candidates are
genuinely relevant, return fewer — do not pad with weak matches.

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
    parser = argparse.ArgumentParser(description="Build the Gemini independent-judging handoff package.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "_pipeline", "candidate_pools.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "gemini_handoff.md"))
    args = parser.parse_args()

    with open(args.in_path) as f:
        pools = json.load(f)

    content = format_handoff(pools)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote handoff package for {len(pools)} queries to {out_path}")
    log_stage("build_gemini_handoff", input_count=len(pools), output_count=len(pools), errors=0)
