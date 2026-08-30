# eval/judge_reconciliation_openai_sync.py
# Usage: python judge_reconciliation_openai_sync.py [--in _pipeline_v2/reconciliation_openai_input.json]
# Requires: OPENAI_API_KEY in eval/.env.local (gitignored -- not in doppler)
#
# Round-2 reconsideration for items where Claude found a document relevant and OpenAI didn't --
# synchronous (not Batch) because round-2 volume is always a small fraction of the full 70-query
# judging pass, so Batch's latency isn't worth it here.

import argparse
import json
import os
import sys

import requests
from dotenv import load_dotenv

from _pipeline_log import log_stage
from judge_pass_openai_smoketest import MAX_COMPLETION_TOKENS, MODEL

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env.local"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("Error: Missing OPENAI_API_KEY in environment.", file=sys.stderr)
    sys.exit(1)

RECONSIDER_PROMPT = (
    "You are reconciling a search-relevance disagreement. A different independent judge found "
    "this document relevant to the query, with the rationale below. You previously judged it not "
    "relevant. Reconsider with this new information.\n\n"
    "Rubric: a document is relevant only if a user typing this exact query would be satisfied "
    "landing on it as a top result -- a passing/tangential mention of a related concept is NOT "
    "enough.\n\n"
    "Return ONLY a JSON object: {\"relevant\": true|false, \"rationale\": \"one sentence\"}. "
    "No markdown fences, no other text."
)


def build_prompt(item: dict) -> str:
    return (f"Query: {item['query']}\nDoc: {item['title']}\nDescription: {item['description']}\n"
            f"Other judge's rationale for relevant: {item['other_rationale']}")


def call_openai(prompt: str) -> str:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={"model": MODEL, "messages": [
            {"role": "system", "content": RECONSIDER_PROMPT},
            {"role": "user", "content": prompt},
        ], "max_completion_tokens": MAX_COMPLETION_TOKENS},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenAI round-2 reconsideration (sync, low volume).")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "reconciliation_openai_input.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "reconciliation_openai_verdicts.json"))
    args = parser.parse_args()

    with open(args.in_path) as f:
        items = json.load(f)

    verdicts = []
    for item in items:
        raw = call_openai(build_prompt(item))
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            print(f"PARSE FAILED for item {item['idx']}: {raw!r}", file=sys.stderr)
            parsed = {"relevant": False, "rationale": "parse failure, defaulted to not-relevant"}
        verdicts.append({"idx": item["idx"], "query": item["query"], "uuid": item["uuid"], "relevant": parsed["relevant"], "rationale": parsed.get("rationale", "")})
        print(f"  [{item['idx']}] {item['query']!r}: {'relevant' if parsed['relevant'] else 'not relevant'}")

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(verdicts, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(verdicts)} verdicts to {out_path}")
    log_stage("judge_reconciliation_openai_sync", input_count=len(items), output_count=len(verdicts), errors=0)
