# eval/parse_gemini_response.py
# Usage: python parse_gemini_response.py --in ../artifacts/gemini_golden_set_judgments_30k.md
#
# Parses Gemini's QUERY:/RELEVANT: response format (per eval/build_gemini_handoff.py's
# instructions) into the same {query, relevant_uuids} shape used by judging pass A.
# Regex-based, not LLM-based — deterministic, zero token cost. Unparseable sections are
# reported explicitly rather than silently dropped.

import argparse
import json
import os
import re
import sys

from _pipeline_log import log_stage

_ENTRY_RE = re.compile(r"QUERY:\s*(?P<query>.+?)\s*\n\s*RELEVANT:\s*(?P<uuids>.*)")


def parse(text: str) -> tuple[list[dict], list[str]]:
    results = []
    unparsed = []
    blocks = text.split("QUERY:")
    for block in blocks[1:]:  # first chunk is preamble/instructions, skip it
        chunk = "QUERY:" + block
        match = _ENTRY_RE.search(chunk)
        if not match:
            unparsed.append(chunk.strip()[:200])
            continue
        query = match.group("query").strip().strip('"')
        uuids_raw = match.group("uuids").strip()
        uuids = [u.strip().strip("`") for u in uuids_raw.split(",") if u.strip()]
        results.append({"query": query, "relevant_uuids": uuids})
    return results, unparsed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse Gemini's QUERY:/RELEVANT: response into judgments JSON.")
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "llm_judgments_b.json"))
    args = parser.parse_args()

    with open(args.in_path, encoding="utf-8") as f:
        text = f.read()

    results, unparsed = parse(text)

    print(f"Parsed {len(results)} queries.")
    if unparsed:
        print(f"WARNING: {len(unparsed)} block(s) could not be parsed — fix the source file and re-run:", file=sys.stderr)
        for u in unparsed:
            print(f"  ---\n  {u}\n  ---", file=sys.stderr)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(results)} judgments to {out_path}")
    log_stage("parse_gemini_response", input_count=40, output_count=len(results), errors=len(unparsed))
