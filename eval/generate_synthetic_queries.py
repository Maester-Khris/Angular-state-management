# eval/generate_synthetic_queries.py
# Usage: python generate_synthetic_queries.py [--in _pipeline/synthesis_candidates.json] [--out _pipeline/synthetic_queries_draft.json]
# Requires: GROQ_API_KEY in environment (same provider/key already used by python-search-api)
#
# One-time script: calls Groq once per sampled document to generate a realistic search query
# for it (Doc2Query-style — the source doc is relevant by construction). Per-item error
# handling: a single failed/malformed generation is logged and skipped, not fatal to the batch.

import argparse
import json
import os
import re
import sys

import requests
from dotenv import load_dotenv

from _pipeline_log import log_stage

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("PYTHON_LLM_MODEL", "llama-3.3-70b-versatile")
MAX_TOKENS = 40  # generous ceiling for a 2-6 word query; explicit per this project's own
                 # earlier Groq TPM lesson (python-search-api/services/inference.py)

if not GROQ_API_KEY:
    print("Error: Missing GROQ_API_KEY in environment.", file=sys.stderr)
    sys.exit(1)

_PUNCTUATION_RE = re.compile(r"[.,;:!?\"']")

SYSTEM_PROMPT = (
    "You generate realistic search queries. Given a blog post's title and description, output "
    "ONE short search query (2-6 words, lowercase, no punctuation) that a user would type to "
    "find this exact post. Output ONLY the query, nothing else."
)


def clean_query(raw: str, max_words: int = 6) -> str:
    cleaned = _PUNCTUATION_RE.sub("", raw).strip().lower()
    return " ".join(cleaned.split()[:max_words])


def call_groq(user_prompt: str) -> str:
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": MAX_TOKENS,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def generate(candidates_path: str) -> tuple[list[dict], list[dict]]:
    with open(candidates_path, encoding="utf-8") as f:
        docs = json.load(f)

    results = []
    failures = []
    seen_queries = set()

    for i, doc in enumerate(docs, start=1):
        user_prompt = f"Title: {doc['title']}\nDescription: {doc['description']}"
        try:
            raw = call_groq(user_prompt)
            query = clean_query(raw)
            if not query or len(query) < 3:
                raise ValueError(f"empty/too-short query after cleaning: {raw!r}")
            if query in seen_queries:
                raise ValueError(f"duplicate query: {query!r}")
            seen_queries.add(query)
            results.append({"query": query, "seed_uuid": doc["uuid"]})
            print(f"  [{i}/{len(docs)}] {doc['title'][:50]!r} -> {query!r}")
        except Exception as e:
            failures.append({"uuid": doc["uuid"], "reason": str(e)})
            print(f"  [{i}/{len(docs)}] FAILED: {e}", file=sys.stderr)

    return results, failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate one synthetic search query per sampled doc via Groq.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "_pipeline", "synthesis_candidates.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "synthetic_queries_draft.json"))
    args = parser.parse_args()

    results, failures = generate(args.in_path)

    print(f"\nGenerated {len(results)} queries, {len(failures)} failures.")
    if failures:
        print(f"Failures:\n{json.dumps(failures, indent=2)}", file=sys.stderr)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(results)} queries to {out_path}")
    log_stage("generate_synthetic_queries", input_count=30, output_count=len(results), errors=len(failures))
