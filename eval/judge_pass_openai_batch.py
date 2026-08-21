# eval/judge_pass_openai_batch.py
# Usage: python judge_pass_openai_batch.py [--in _pipeline_v2/candidate_pools.json] [--out _pipeline_v2/llm_judgments_openai.json]
# Requires: OPENAI_API_KEY in environment
#
# Judging pass A (v2): OpenAI gpt-5-mini via the Batch API (50% discount vs sync, no real-time
# requirement for this offline workload). One request per query, graded relevance (1/2, omit 0),
# no selection cap. Polls until the batch completes (up to 24h per OpenAI's SLA, typically
# faster) -- this script blocks and prints progress rather than being resumable across runs,
# since a single batch job either completes or fails as a unit.

import argparse
import json
import os
import sys
import time

import requests
from dotenv import load_dotenv

from _pipeline_log import log_stage
from judge_pass_openai_smoketest import MODEL, SYSTEM_PROMPT, build_user_prompt

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MAX_COMPLETION_TOKENS = 2000  # raise if the smoke test showed truncation
POLL_SECONDS = 30

if not OPENAI_API_KEY:
    print("Error: Missing OPENAI_API_KEY in environment.", file=sys.stderr)
    sys.exit(1)

HEADERS = {"Authorization": f"Bearer {OPENAI_API_KEY}"}


def build_batch_requests(pools: list[dict]) -> list[dict]:
    return [
        {
            "custom_id": f"q{i}",
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(pool)},
                ],
                "max_completion_tokens": MAX_COMPLETION_TOKENS,
            },
        }
        for i, pool in enumerate(pools)
    ]


def submit_batch(requests_jsonl_path: str) -> str:
    with open(requests_jsonl_path, "rb") as f:
        upload = requests.post(
            "https://api.openai.com/v1/files",
            headers=HEADERS,
            files={"file": f},
            data={"purpose": "batch"},
        )
    upload.raise_for_status()
    input_file_id = upload.json()["id"]

    batch = requests.post(
        "https://api.openai.com/v1/batches",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"input_file_id": input_file_id, "endpoint": "/v1/chat/completions", "completion_window": "24h"},
    )
    batch.raise_for_status()
    return batch.json()["id"]


def poll_batch(batch_id: str) -> dict:
    while True:
        resp = requests.get(f"https://api.openai.com/v1/batches/{batch_id}", headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        print(f"  batch {batch_id}: status={data['status']} "
              f"(completed={data['request_counts']['completed']}/{data['request_counts']['total']})")
        if data["status"] in ("completed", "failed", "expired", "cancelled"):
            return data
        time.sleep(POLL_SECONDS)


def parse_batch_output(output_file_id: str, pools: list[dict]) -> list[dict]:
    resp = requests.get(f"https://api.openai.com/v1/files/{output_file_id}/content", headers=HEADERS)
    resp.raise_for_status()

    by_custom_id: dict[str, dict] = {}
    for line in resp.text.strip().split("\n"):
        entry = json.loads(line)
        custom_id = entry["custom_id"]
        content = entry["response"]["body"]["choices"][0]["message"]["content"].strip()
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = []
        by_custom_id[custom_id] = parsed

    results = []
    for i, pool in enumerate(pools):
        valid_uuids = {c["uuid"] for c in pool["candidates"]}
        raw_items = by_custom_id.get(f"q{i}", [])
        judgments = [
            {"uuid": item["uuid"], "relevance": item.get("relevance", 1), "rationale": item.get("rationale", "")}
            for item in raw_items
            if item.get("uuid") in valid_uuids
        ]
        results.append({"query": pool["query"], "judgments": judgments})
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Judging pass A (v2): score candidate pools via OpenAI Batch API.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "candidate_pools.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "llm_judgments_openai.json"))
    args = parser.parse_args()

    with open(args.in_path) as f:
        pools = json.load(f)

    batch_input_path = os.path.join(os.path.dirname(__file__), "_pipeline_v2", "openai_batch_input.jsonl")
    with open(batch_input_path, "w", encoding="utf-8") as f:
        for req in build_batch_requests(pools):
            f.write(json.dumps(req) + "\n")
    print(f"Wrote {len(pools)} batch requests to {batch_input_path}")

    batch_id = submit_batch(batch_input_path)
    print(f"Submitted batch {batch_id}, polling every {POLL_SECONDS}s...")
    final = poll_batch(batch_id)

    if final["status"] != "completed":
        print(f"Batch did not complete: status={final['status']}, errors={final.get('errors')}", file=sys.stderr)
        sys.exit(1)

    results = parse_batch_output(final["output_file_id"], pools)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(results)} judgments to {out_path}")
    log_stage("judge_pass_openai_batch", input_count=len(pools), output_count=len(results), errors=0)
