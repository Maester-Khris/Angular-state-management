# eval/judge_pass_openai_smoketest.py
# Usage: python judge_pass_openai_smoketest.py [--in _pipeline_v2/candidate_pools.json] [--count 2]
# Requires: OPENAI_API_KEY in eval/.env.local (gitignored -- not in doppler)
#
# Synchronous smoke test against 1-2 real query pools before committing to the full Batch run --
# confirms actual reasoning-token consumption and rationale quality on real pool data, per the
# rebuild spec's explicit caution against extrapolating the cost estimate without live
# verification (the same lesson learned three times already this sprint with Groq's
# gpt-oss-120b). Not resumable, not incremental -- throwaway verification only.

import argparse
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()  # picks up doppler-injected vars if present
load_dotenv(os.path.join(os.path.dirname(__file__), ".env.local"))  # OPENAI_API_KEY lives here, not doppler

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = "gpt-5-mini"
DESCRIPTION_CHARS = 150
MAX_COMPLETION_TOKENS = 8000  # gpt-5-mini spends completion tokens on hidden reasoning before
                              # the JSON answer (same lesson as Groq's gpt-oss-120b elsewhere in
                              # this pipeline). Smoke-tested empirically: a 35-candidate pool at
                              # 2000 burned the entire budget on reasoning with zero output; at
                              # 6000 it used ~3000 total (2048 reasoning + output) successfully.
                              # 8000 gives headroom for the largest pool seen (55 candidates).

if not OPENAI_API_KEY:
    print("Error: Missing OPENAI_API_KEY in environment.", file=sys.stderr)
    sys.exit(1)

SYSTEM_PROMPT = (
    "You are judging search relevance. Given a query and a list of candidate documents, grade "
    "every genuinely relevant candidate: 1 = relevant (a user typing this query would be "
    "satisfied landing on it as a top result), 2 = highly relevant (it's a near-perfect match). "
    "A passing or tangential mention of a related concept is NOT relevant -- the document's core "
    "topic must match the query. There is no limit on how many candidates you may grade 1 or 2, "
    "and no minimum -- grade exactly as many as are genuinely relevant, including zero.\n\n"
    "Return ONLY a JSON array of objects for candidates graded 1 or 2 (omit anything graded 0): "
    "[{\"uuid\": \"...\", \"relevance\": 1, \"rationale\": \"one sentence\"}]. "
    "No markdown fences, no other text."
)


def build_user_prompt(pool: dict) -> str:
    candidate_block = "\n\n".join(
        f"- uuid: {c['uuid']}\n  Title: {c['title']}\n  Description: {c['description'][:DESCRIPTION_CHARS]}"
        for c in pool["candidates"]
    )
    return f"Query: {pool['query']}\n\nCandidates:\n{candidate_block}"


def call_openai_sync(user_prompt: str) -> str:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "max_completion_tokens": MAX_COMPLETION_TOKENS,
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    usage = data.get("usage", {})
    print(f"    usage: prompt={usage.get('prompt_tokens')} completion={usage.get('completion_tokens')} "
          f"(reasoning={usage.get('completion_tokens_details', {}).get('reasoning_tokens', 'n/a')})")
    return data["choices"][0]["message"]["content"].strip()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Synchronous OpenAI judging smoke test on 1-2 real pools.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "candidate_pools.json"))
    parser.add_argument("--count", type=int, default=2)
    args = parser.parse_args()

    with open(args.in_path) as f:
        pools = json.load(f)

    for pool in pools[:args.count]:
        print(f"\n--- '{pool['query']}' ({len(pool['candidates'])} candidates) ---")
        raw = call_openai_sync(build_user_prompt(pool))
        print(f"    response: {raw[:500]}")
        try:
            parsed = json.loads(raw)
            print(f"    parsed OK: {len(parsed)} relevant items")
        except json.JSONDecodeError as e:
            print(f"    PARSE FAILED: {e}", file=sys.stderr)
