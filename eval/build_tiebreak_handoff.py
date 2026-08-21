# eval/build_tiebreak_handoff.py
# Usage: python build_tiebreak_handoff.py
#
# Round 3: items still disputed after round 2 always have OpenAI-final and Claude-final
# verdicts in a 1-1 split (round 2 already resolved anything that flipped). A FRESH Claude
# conversation (not the same one as round 2) sees both original rationales, anonymized (not
# told which model gave which), and casts the deciding vote -- majority-of-three, replacing the
# original process's "default to one model's earlier verdict" (the single-annotator collapse
# the audit flagged for 28 items last time).

import json
import os
import random

from _pipeline_log import log_stage

BASE = os.path.dirname(__file__)

INSTRUCTIONS = """# Golden Query Disagreement Tie-Break — Round 3

Two independent judges disagreed on each item below, even after a reconsideration round. Two
anonymous rationales are shown for each (their order is randomized — they are not labeled by
source). Cast the deciding vote: is this document relevant to the query?

Rubric: a document is relevant only if a user typing this exact query would be satisfied landing
on it as a top result — a passing/tangential mention of a related concept is NOT enough.

Return one block per item, in this exact format:

```
ITEM: <idx>
RELEVANT: yes|no
```

---

"""


def format_handoff(items: list[dict], rng: random.Random) -> str:
    lines = [INSTRUCTIONS]
    for item in items:
        rationales = [item["a_rationale"] or "(no rationale given)", item["b_rationale"] or "(no rationale given)"]
        rng.shuffle(rationales)
        lines.append(f"## Item {item['idx']}")
        lines.append(f"Query: \"{item['query']}\"")
        lines.append(f"Doc: **{item['title']}**")
        lines.append(f"Description: {item['description']}")
        lines.append(f"Rationale 1 (for relevant): {rationales[0]}")
        lines.append(f"Rationale 2 (for relevant): {rationales[1]}")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    with open(os.path.join(BASE, "_pipeline_v2", "still_disputed.json")) as f:
        disputed = json.load(f)
    with open(os.path.join(BASE, "_pipeline_v2", "candidate_pools.json")) as f:
        pools = json.load(f)
    title_desc = {c["uuid"]: c for p in pools for c in p["candidates"]}

    items = []
    for idx, d in enumerate(disputed, start=1):
        doc = title_desc.get(d["uuid"], {"title": "<unknown>", "description": ""})
        items.append({"idx": idx, "query": d["query"], "uuid": d["uuid"], "title": doc["title"], "description": doc["description"],
                       "a_rationale": d["a_rationale"], "b_rationale": d["b_rationale"]})

    rng = random.Random(17)
    content = format_handoff(items, rng)

    with open(os.path.join(BASE, "_pipeline_v2", "tiebreak_handoff.md"), "w", encoding="utf-8") as f:
        f.write(content)
    with open(os.path.join(BASE, "_pipeline_v2", "tiebreak_handoff_items.json"), "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"Wrote tie-break handoff for {len(items)} items to _pipeline_v2/tiebreak_handoff.md")
    log_stage("build_tiebreak_handoff", input_count=len(disputed), output_count=len(items), errors=0)
