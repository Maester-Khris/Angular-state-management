# eval/parse_reconciliation_claude_v2.py
# Usage: python parse_reconciliation_claude_v2.py --in <path to Claude's pasted round-2 response>
#
# Parses round-2's ITEM:/RELEVANT:/RATIONALE: format into verdicts, matching
# reconciliation_openai_verdicts.json's shape.

import argparse
import json
import os
import re
import sys

from _pipeline_log import log_stage

_BLOCK_RE = re.compile(r"ITEM:\s*(?P<idx>\d+)\s*\nRELEVANT:\s*(?P<relevant>yes|no)\s*\nRATIONALE:\s*(?P<rationale>.+)")


def parse(text: str, items_by_idx: dict[int, dict]) -> tuple[list[dict], list[str]]:
    verdicts = []
    unparsed = []
    for match in _BLOCK_RE.finditer(text):
        idx = int(match.group("idx"))
        item = items_by_idx.get(idx)
        if not item:
            unparsed.append(f"unknown idx {idx}")
            continue
        verdicts.append({
            "idx": idx, "query": item["query"], "uuid": item["uuid"],
            "relevant": match.group("relevant") == "yes", "rationale": match.group("rationale").strip(),
        })
    found_idxs = {v["idx"] for v in verdicts}
    for idx in items_by_idx:
        if idx not in found_idxs:
            unparsed.append(f"missing verdict for idx {idx}")
    return verdicts, unparsed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse Claude's round-2 reconciliation response.")
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--items", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "reconciliation_claude_handoff_items.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "reconciliation_claude_verdicts.json"))
    args = parser.parse_args()

    with open(args.in_path, encoding="utf-8") as f:
        text = f.read()
    with open(args.items) as f:
        items_by_idx = {item["idx"]: item for item in json.load(f)}

    verdicts, unparsed = parse(text, items_by_idx)
    print(f"Parsed {len(verdicts)} verdicts.")
    if unparsed:
        print(f"WARNING: {len(unparsed)} issue(s):", file=sys.stderr)
        for u in unparsed:
            print(f"  - {u}", file=sys.stderr)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(verdicts, f, indent=2, ensure_ascii=False)
    print(f"Saved to {out_path}")
    log_stage("parse_reconciliation_claude_v2", input_count=len(items_by_idx), output_count=len(verdicts), errors=len(unparsed))
