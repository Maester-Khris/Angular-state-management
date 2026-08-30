# eval/judge_candidate_pools.py
# Usage: python judge_candidate_pools.py [--in _pipeline/candidate_pools.json] [--out _pipeline/llm_judgments_a.json]
# Requires: GROQ_API_KEY in environment
#
# One-time script: judging pass A. Calls Groq once per query's candidate pool, applying the
# same relevance rubric used in the Gemini handoff (eval/build_gemini_handoff.py) — this and
# that script must NOT read each other's output, so the two passes stay genuinely independent.
#
# Resumable: loads any existing --out file first and skips queries already judged, writing
# incrementally after every query (not just at the end) so an interrupted run never loses
# progress or re-spends budget re-judging what already succeeded. This matters in practice —
# Groq's TPD (tokens per day) limit was hit mid-development, and TPM-style short backoff can't
# fix a TPD wall, so a TPD error fails that query immediately instead of burning through retries.

import argparse
import json
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv

from _pipeline_log import log_stage

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("PYTHON_LLM_MODEL", "openai/gpt-oss-120b")  # llama-3.3-70b-versatile removed from Groq's catalog 2026-08-18
MAX_TOKENS = 4000  # gpt-oss-120b is a reasoning model -- spends tokens on a hidden reasoning
                   # field before the JSON answer (same issue as MAX_EXPANSION_TOKENS in
                   # python-search-api/services/inference.py). 400 was fine for ~30-40 candidate
                   # pools; 1500 still wasn't enough for some ~65-80 candidate pools -- observed
                   # the model walking through every candidate one-by-one in its reasoning trace
                   # (verbose, ~20-30 tokens/candidate) and getting cut off before the JSON
                   # answer. 4000 gives headroom for that style on the widest pools seen so far.
DESCRIPTION_CHARS = 150  # candidate descriptions are truncated in the prompt (not the judged
                         # data) to cut per-call token cost — same TPM lesson as above
DESCRIPTION_CHARS = 150  # candidate descriptions are truncated in the prompt (not the judged
                         # data) to cut per-call token cost — same TPM lesson as above
PACING_SECONDS = 1.5  # small delay between calls to avoid bursting through the TPM budget
                      # even when not currently throttled

if not GROQ_API_KEY:
    print("Error: Missing GROQ_API_KEY in environment.", file=sys.stderr)
    sys.exit(1)

SYSTEM_PROMPT = (
    "You are judging search relevance. Given a query and a list of candidate documents, select "
    "only the documents a user typing this exact query would be satisfied landing on as a top "
    "result. A passing or tangential mention of a related concept is NOT relevant — the "
    "document's core topic must match the query. Select 0-5 documents; do not pad with weak "
    "matches.\n\n"
    "Return ONLY a JSON array of objects: [{\"uuid\": \"...\", \"rationale\": \"one sentence\"}]. "
    "No markdown fences, no other text."
)


MAX_RETRIES = 4
DEFAULT_BACKOFF_SECONDS = 20  # fallback if Groq doesn't send Retry-After; TPM windows are ~60s
MAX_BACKOFF_SECONDS = 65  # cap even for a large reported Retry-After on a TPM (per-minute) hit


class DailyLimitExceeded(Exception):
    """TPD (tokens per day) exhausted — retrying within this run cannot help, unlike TPM."""


def call_groq(user_prompt: str) -> str:
    for attempt in range(1, MAX_RETRIES + 1):
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.0,
                "max_tokens": MAX_TOKENS,
            },
            timeout=60,
        )
        if resp.status_code == 429:
            body = resp.text
            if "tokens per day" in body or "TPD" in body:
                wait_match = re.search(r"try again in ([\d.]+)m?([\d.]+)?s", body)
                readable = wait_match.group(0) if wait_match else "unknown time"
                raise DailyLimitExceeded(f"Groq daily token limit (TPD) hit — {readable}. Body: {body[:200]}")
            wait = min(float(resp.headers.get("Retry-After", DEFAULT_BACKOFF_SECONDS)), MAX_BACKOFF_SECONDS)
            print(f"    429 (TPM) rate limited, waiting {wait:.0f}s (attempt {attempt}/{MAX_RETRIES})...", file=sys.stderr)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    raise RuntimeError(f"gave up after {MAX_RETRIES} retries, still rate limited")


def parse_response(raw: str) -> list[dict]:
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def load_existing(out_path: str) -> dict[str, dict]:
    if not os.path.exists(out_path):
        return {}
    with open(out_path, encoding="utf-8") as f:
        data = json.load(f)
    return {entry["query"]: entry for entry in data}


def write_results(out_path: str, by_query: dict[str, dict]) -> None:
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(list(by_query.values()), f, indent=2, ensure_ascii=False)


def judge(pools_path: str, out_path: str) -> tuple[dict[str, dict], list[dict], bool]:
    with open(pools_path, encoding="utf-8") as f:
        pools = json.load(f)

    by_query = load_existing(out_path)
    already_done = set(by_query.keys())
    if already_done:
        print(f"Resuming: {len(already_done)}/{len(pools)} queries already judged, skipping those.")

    failures = []
    hit_daily_limit = False

    for i, pool in enumerate(pools, start=1):
        if pool["query"] in already_done:
            continue

        candidate_block = "\n\n".join(
            f"- uuid: {c['uuid']}\n  Title: {c['title']}\n  Description: {c['description'][:DESCRIPTION_CHARS]}"
            for c in pool["candidates"]
        )
        user_prompt = f"Query: {pool['query']}\n\nCandidates:\n{candidate_block}"

        try:
            raw = call_groq(user_prompt)
            parsed = parse_response(raw)
            valid_uuids = {c["uuid"] for c in pool["candidates"]}
            relevant_uuids = []
            rationale = {}
            for item in parsed:
                if item.get("uuid") not in valid_uuids:
                    continue  # ignore hallucinated uuids not in the actual pool
                relevant_uuids.append(item["uuid"])
                rationale[item["uuid"]] = item.get("rationale", "")
            by_query[pool["query"]] = {"query": pool["query"], "relevant_uuids": relevant_uuids, "rationale": rationale}
            write_results(out_path, by_query)  # incremental — survives interruption
            print(f"  [{i}/{len(pools)}] '{pool['query']}': {len(relevant_uuids)} relevant")
            time.sleep(PACING_SECONDS)
        except DailyLimitExceeded as e:
            print(f"  [{i}/{len(pools)}] STOPPING: {e}", file=sys.stderr)
            hit_daily_limit = True
            break
        except Exception as e:
            failures.append({"query": pool["query"], "reason": str(e)})
            print(f"  [{i}/{len(pools)}] FAILED: {e}", file=sys.stderr)

    return by_query, failures, hit_daily_limit


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Judging pass A: score candidate pools via Groq.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "_pipeline", "candidate_pools.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "llm_judgments_a.json"))
    args = parser.parse_args()

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    by_query, failures, hit_daily_limit = judge(args.in_path, out_path)

    with open(args.in_path, encoding="utf-8") as f:
        total = len(json.load(f))

    print(f"\nJudged {len(by_query)}/{total} queries total ({len(failures)} failures this run).")
    if failures:
        print(f"Failures:\n{json.dumps(failures, indent=2)}", file=sys.stderr)
    if hit_daily_limit:
        print("Stopped early: Groq daily token limit hit. Re-run this script later to resume — already-judged queries are skipped.", file=sys.stderr)

    print(f"Saved {len(by_query)} judgments to {out_path}")
    log_stage("judge_candidate_pools_pass_a", input_count=total, output_count=len(by_query), errors=len(failures))
