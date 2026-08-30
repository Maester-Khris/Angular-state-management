# eval/build_disagreement_rationale_handoff.py
# Usage: python build_disagreement_rationale_handoff.py
#
# Second-round handoff for the 28 items where Claude's and Gemini's first disagreement-round
# verdicts still disagreed (eval/_pipeline/disagreement_reconciliation.json's "disagree" list).
# This time explicitly requests rationale -- the first round's terse yes/no format gave no way
# to understand why Gemini rejected several near-canonical topic matches, which this round is
# meant to surface. Deliberately does NOT show Claude's verdict or rationale, same
# anchoring-avoidance principle as every prior handoff.

import json
import os

from _pipeline_log import log_stage

INSTRUCTIONS = """# Golden Query Disagreement Adjudication — Round 2 (with rationale)

These are items where two independent judging passes disagreed on relevance. Give your own
independent call for each, AND a brief rationale explaining your reasoning -- the previous
round's yes/no-only format made some verdicts impossible to sanity-check, this round fixes that.

Rubric: a document is relevant only if a user typing this exact query would be satisfied
landing on it as a top result -- a passing/tangential mention of a related concept is NOT
enough. The document's core topic must match the query, not just share a keyword.

Return one line per item, in this exact format:

```
ITEM: <idx>
RELEVANT: yes|no
RATIONALE: <one sentence explaining why>
```

One block per item, using the exact idx number shown.

---

"""


def format_handoff(items: list[dict]) -> str:
    lines = [INSTRUCTIONS]
    for item in items:
        lines.append(f"## Item {item['idx']}")
        lines.append(f"Query: \"{item['query']}\"")
        lines.append(f"Doc: **{item['title']}**")
        lines.append(f"Description: {item['description']}")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    base = os.path.dirname(__file__)
    with open(os.path.join(base, "_pipeline", "disagreement_reconciliation.json")) as f:
        recon = json.load(f)

    # strip claude/gemini verdicts before formatting -- must not leak into the handoff
    clean_items = [
        {k: v for k, v in item.items() if k not in ("claude_relevant", "gemini_relevant")}
        for item in recon["disagree"]
    ]

    content = format_handoff(clean_items)
    out_path = os.path.join(base, "_pipeline", "gemini_disagreement_rationale_handoff.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Wrote round-2 handoff for {len(clean_items)} still-disputed items to {out_path}")
    log_stage("build_disagreement_rationale_handoff", input_count=len(clean_items), output_count=len(clean_items), errors=0)
