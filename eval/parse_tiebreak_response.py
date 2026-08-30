# eval/parse_tiebreak_response.py
# Usage: python parse_tiebreak_response.py --in <path to Claude's pasted round-3 response>

import argparse
import json
import os
import re
import sys

from _pipeline_log import log_stage

_BLOCK_RE = re.compile(r"ITEM:\s*(?P<idx>\d+)\s*\nRELEVANT:\s*(?P<relevant>yes|no)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse the round-3 tie-break response.")
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--items", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "tiebreak_handoff_items.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "tiebreak_verdicts.json"))
    args = parser.parse_args()

    with open(args.in_path, encoding="utf-8") as f:
        text = f.read()
    with open(args.items) as f:
        items_by_idx = {item["idx"]: item for item in json.load(f)}

    verdicts = []
    found = set()
    for match in _BLOCK_RE.finditer(text):
        idx = int(match.group("idx"))
        item = items_by_idx.get(idx)
        if not item:
            continue
        verdicts.append({"query": item["query"], "uuid": item["uuid"], "relevant": match.group("relevant") == "yes"})
        found.add(idx)

    missing = set(items_by_idx) - found
    if missing:
        print(f"WARNING: no verdict found for idx {sorted(missing)}", file=sys.stderr)

    out_path = os.path.abspath(args.out)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(verdicts, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(verdicts)} tie-break verdicts to {out_path}")
    log_stage("parse_tiebreak_response", input_count=len(items_by_idx), output_count=len(verdicts), errors=len(missing))
