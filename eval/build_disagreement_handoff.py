# eval/build_disagreement_handoff.py
# Usage: python build_disagreement_handoff.py
#
# Formats the 74 unresolved disagreements from the original golden-set judging into a clean
# markdown package for an independent Gemini pass -- deliberately excludes Claude's verdicts
# (claude_disagreement_verdicts_full.json) so this stays a genuine second opinion, not
# verification of Claude's picks, same anchoring-avoidance principle as the original
# build_gemini_handoff.py.

import json
import os

from _pipeline_log import log_stage

INSTRUCTIONS = """# Golden Query Disagreement Adjudication

The original two-pass judging (Groq automated + your own earlier independent pass) disagreed
on relevance for each item below -- one pass said relevant, the other said not. For each item,
give your own independent call: is this document relevant to the query?

Rubric: a document is relevant only if a user typing this exact query would be satisfied
landing on it as a top result -- a passing/tangential mention of a related concept is NOT
enough. The document's core topic must match the query, not just share a keyword.

Return one line per item, in this exact format:

```
ITEM: <idx>
RELEVANT: yes|no
```

One line per item, using the exact idx number shown. 74 items total.

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
    with open(os.path.join(base, "_pipeline", "claude_disagreement_verdicts_full.json")) as f:
        items = json.load(f)

    # strip claude_relevant before formatting -- must not leak into the handoff
    clean_items = [{k: v for k, v in item.items() if k != "claude_relevant"} for item in items]

    content = format_handoff(clean_items)
    out_path = os.path.join(base, "_pipeline", "gemini_disagreement_handoff.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Wrote handoff package for {len(clean_items)} disagreement items to {out_path}")
    log_stage("build_disagreement_handoff", input_count=len(clean_items), output_count=len(clean_items), errors=0)
