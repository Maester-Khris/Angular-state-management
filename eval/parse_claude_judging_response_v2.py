# eval/parse_claude_judging_response_v2.py
# Usage: python parse_claude_judging_response_v2.py --in <path to Claude's pasted response>
#
# Parses the QUERY:/RELEVANT: <uuid>:<grade> format (per build_claude_judging_handoff_v2.py's
# instructions) into the same {query, judgments} shape as the OpenAI batch pass. Regex-based,
# deterministic. Unparseable sections are reported explicitly, never silently dropped.

import argparse
import json
import os
import re
import sys

from _pipeline_log import log_stage

_ENTRY_RE = re.compile(r"QUERY:\s*(?P<query>.+?)\s*\n\s*RELEVANT:\s*(?P<items>.*)")


def parse(text: str) -> tuple[list[dict], list[str]]:
    results = []
    unparsed = []
    blocks = text.split("QUERY:")
    for block in blocks[1:]:
        chunk = "QUERY:" + block
        match = _ENTRY_RE.search(chunk)
        if not match:
            unparsed.append(chunk.strip()[:200])
            continue
        query = match.group("query").strip().strip('"')
        items_raw = match.group("items").strip()
        judgments = []
        if items_raw:
            for item in items_raw.split(","):
                item = item.strip()
                if ":" not in item:
                    unparsed.append(f"malformed item {item!r} for query {query!r}")
                    continue
                uuid, grade = item.rsplit(":", 1)
                judgments.append({"uuid": uuid.strip().strip("`"), "relevance": int(grade.strip()), "rationale": ""})
        results.append({"query": query, "judgments": judgments})
    return results, unparsed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse Claude's v2 QUERY:/RELEVANT: response into judgments JSON.")
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "llm_judgments_claude.json"))
    args = parser.parse_args()

    with open(args.in_path, encoding="utf-8") as f:
        text = f.read()

    results, unparsed = parse(text)

    print(f"Parsed {len(results)} queries.")
    if unparsed:
        print(f"WARNING: {len(unparsed)} unparsed item(s) — fix the source and re-run:", file=sys.stderr)
        for u in unparsed:
            print(f"  ---\n  {u}\n  ---", file=sys.stderr)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(results)} judgments to {out_path}")
    log_stage("parse_claude_judging_response_v2", input_count=70, output_count=len(results), errors=len(unparsed))
