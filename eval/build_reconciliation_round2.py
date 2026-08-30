# eval/build_reconciliation_round2.py
# Usage: python build_reconciliation_round2.py
#
# Round 2: for each relevance disagreement (Task 11), the judge who said "not relevant" is shown
# the OTHER judge's rationale (anonymized -- not told which model) and asked to reconsider with
# their own rationale. This is a genuine reconsideration with new information, not a blind
# re-ask -- the flaw the audit found in the original process's asymmetric "default to one
# model's earlier verdict" pattern. Two directions are handled differently: Claude reconsiders
# via a fresh-context conversational handoff (this script's markdown output); OpenAI reconsiders
# via a small synchronous batch (judge_reconciliation_openai_sync.py) since round-2 volume is
# always small enough that Batch API's latency isn't worth it.

import json
import os

from _pipeline_log import log_stage

BASE = os.path.dirname(__file__)

CLAUDE_INSTRUCTIONS = """# Golden Query Disagreement Reconciliation — Round 2

For each item below, a different independent judge found this document relevant to the query,
with the rationale shown. You previously judged it not relevant. Reconsider with this new
information and give your own independent call, plus a one-sentence rationale.

Rubric: a document is relevant only if a user typing this exact query would be satisfied landing
on it as a top result — a passing/tangential mention of a related concept is NOT enough.

Return one block per item, in this exact format:

```
ITEM: <idx>
RELEVANT: yes|no
RATIONALE: <one sentence>
```

---

"""


def build_claude_handoff(items: list[dict]) -> str:
    lines = [CLAUDE_INSTRUCTIONS]
    for item in items:
        lines.append(f"## Item {item['idx']}")
        lines.append(f"Query: \"{item['query']}\"")
        lines.append(f"Doc: **{item['title']}**")
        lines.append(f"Description: {item['description']}")
        lines.append(f"Other judge's rationale for relevant: {item['other_rationale']}")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    with open(os.path.join(BASE, "_pipeline_v2", "agreement_report.json")) as f:
        report = json.load(f)
    with open(os.path.join(BASE, "_pipeline_v2", "candidate_pools.json")) as f:
        pools = json.load(f)

    title_desc = {c["uuid"]: c for p in pools for c in p["candidates"]}

    claude_reconsiders = []  # a_relevant (OpenAI) True, b_relevant (Claude) False
    openai_reconsiders = []  # b_relevant (Claude) True, a_relevant (OpenAI) False

    for idx, d in enumerate(report["disagreements"], start=1):
        doc = title_desc.get(d["uuid"], {"title": "<unknown>", "description": ""})
        base = {"idx": idx, "query": d["query"], "uuid": d["uuid"], "title": doc["title"], "description": doc["description"]}
        if d["a_relevant"] and not d["b_relevant"]:
            claude_reconsiders.append({**base, "other_rationale": d["a_rationale"]})
        elif d["b_relevant"] and not d["a_relevant"]:
            openai_reconsiders.append({**base, "other_rationale": d["b_rationale"]})

    claude_md = build_claude_handoff(claude_reconsiders)
    with open(os.path.join(BASE, "_pipeline_v2", "reconciliation_claude_handoff.md"), "w", encoding="utf-8") as f:
        f.write(claude_md)
    with open(os.path.join(BASE, "_pipeline_v2", "reconciliation_claude_handoff_items.json"), "w", encoding="utf-8") as f:
        json.dump(claude_reconsiders, f, indent=2, ensure_ascii=False)

    with open(os.path.join(BASE, "_pipeline_v2", "reconciliation_openai_input.json"), "w", encoding="utf-8") as f:
        json.dump(openai_reconsiders, f, indent=2, ensure_ascii=False)

    print(f"Claude reconsiders {len(claude_reconsiders)} items, OpenAI reconsiders {len(openai_reconsiders)} items.")
    log_stage("build_reconciliation_round2", input_count=len(report["disagreements"]),
              output_count=len(claude_reconsiders) + len(openai_reconsiders), errors=0)
