# eval/spike_exa_summary_vs_reranking.py
# Usage: python spike_exa_summary_vs_reranking.py [--sample-size 10] [--out report.json]
# Requires: GROQ_API_KEY, EXA_API_KEY in environment
#
# One-off spike comparison for Phase 9 (docs/superpowers/plans/2026-08-09-ai-search-pipeline-
# upgrade.md) / docs/superpowers/plans/2026-08-19-exa-summary-vs-reranking-spike.md's Task 5
# decision gate. For a sample of the finalized golden set: runs live Exa web search once per
# query, feeds the identical results into both generate_relevant_sources (old, Groq) and
# ExaSourceSummaryAdapter.summarize (new, Exa REST /contents), then scores the pair with the
# swap-augmented judge.
#
# Resumable: 3 Groq calls per query (generate_relevant_sources + 2 judge_pair calls), not 2 as
# originally estimated -- hit a real TPD wall mid-run at sample-size 10 (2026-08-19). Loads any
# existing --out report first, skips queries already present, writes incrementally after every
# query (not just at the end), same pattern eval/judge_candidate_pools.py already proved out.
# TPD (tokens per day) stops the run immediately -- retrying within the same run can't help;
# re-run this script later and it resumes from where it left off.

import argparse
import asyncio
import json
import os
import random
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "python-search-api"))

from dotenv import load_dotenv
from groq import RateLimitError
from pairwise_judge import compare_swap_augmented
from services.inference import InferenceService
from services.search_providers.exa_provider import ExaWebSearchAdapter
from services.search_providers.exa_summary_provider import ExaSourceSummaryAdapter

load_dotenv()


class DailyLimitExceeded(Exception):
    """TPD (tokens per day) exhausted -- retrying within this run cannot help."""


def load_sample(golden_path: str, sample_size: int, seed: int = 42) -> list[dict]:
    with open(golden_path, encoding="utf-8") as f:
        queries = json.load(f)
    random.Random(seed).shuffle(queries)
    return queries[:sample_size]


def to_web_result_dicts(web_results) -> list[dict]:
    return [
        {"title": r.title, "url": r.url, "favicon": r.favicon, "description": r.snippet}
        for r in web_results
    ]


def build_context(web_results) -> str:
    return "\n\n".join(f"{r.title}: {r.snippet}" for r in web_results)


def load_existing(out_path: str) -> dict[str, dict]:
    if not os.path.exists(out_path):
        return {}
    with open(out_path, encoding="utf-8") as f:
        data = json.load(f)
    return {entry["query"]: entry for entry in data.get("results", [])}


def build_report(by_query: dict[str, dict]) -> dict:
    faithfulness_tally = {"old": 0, "new": 0, "tie": 0}
    relevance_tally = {"old": 0, "new": 0, "tie": 0}
    for r in by_query.values():
        faithfulness_tally[r["verdict"]["faithfulness"]] += 1
        relevance_tally[r["verdict"]["answer_relevance"]] += 1
    return {
        "sample_size": len(by_query),
        "faithfulness_tally": faithfulness_tally,
        "answer_relevance_tally": relevance_tally,
        "results": list(by_query.values()),
    }


def write_report(out_path: str, by_query: dict[str, dict]) -> None:
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(build_report(by_query), f, indent=2, ensure_ascii=False)


async def process_query(query: str, websearch_svc, llm_svc, summary_svc) -> dict | None:
    web_results = await websearch_svc.search(query, limit=8)
    if not web_results:
        print("  no web results, skipping")
        return None

    web_dicts = to_web_result_dicts(web_results)
    try:
        old_sources = await llm_svc.generate_relevant_sources(query, web_dicts)
    except RateLimitError as e:
        body = str(e)
        if "tokens per day" in body or "TPD" in body:
            raise DailyLimitExceeded(f"Groq daily token limit (TPD) hit: {body[:200]}")
        raise  # TPM on this call is unexpected (generate_relevant_sources has no retry loop
               # of its own) -- surface it rather than silently skipping a real failure

    new_sources = summary_svc.summarize(query, web_dicts)  # sync -- REST call, not MCP

    if not old_sources or not new_sources:
        print(f"  incomplete output (old={len(old_sources)}, new={len(new_sources)}), skipping")
        return None

    context = build_context(web_results)
    # Compare the top source from each side -- the decision gate cares about overall output
    # quality per query, not a full cross-product of every source pair.
    verdict = await compare_swap_augmented(query, context, old_sources[0], new_sources[0])
    return {"query": query, "verdict": verdict}


async def run(sample_size: int, out_path: str) -> dict:
    golden_path = os.path.join(os.path.dirname(__file__), "golden_queries_30k.json")
    sample = load_sample(golden_path, sample_size)

    by_query = load_existing(out_path)
    already_done = set(by_query.keys())
    if already_done:
        print(f"Resuming: {len(already_done)}/{len(sample)} queries already done, skipping those.")

    websearch_svc = ExaWebSearchAdapter()
    llm_svc = InferenceService()
    summary_svc = ExaSourceSummaryAdapter()

    hit_daily_limit = False
    for i, entry in enumerate(sample, start=1):
        query = entry["query"]
        if query in already_done:
            continue
        print(f"[{i}/{len(sample)}] {query}")

        try:
            result = await process_query(query, websearch_svc, llm_svc, summary_svc)
        except DailyLimitExceeded as e:
            print(f"  STOPPING: {e}")
            hit_daily_limit = True
            break
        except Exception as e:
            print(f"  FAILED: {e}")
            continue

        if result is not None:
            by_query[query] = result
            write_report(out_path, by_query)  # incremental -- survives interruption

    report = build_report(by_query)
    print(f"\nWrote report to {out_path}")
    print(json.dumps({"faithfulness": report["faithfulness_tally"], "answer_relevance": report["answer_relevance_tally"]}, indent=2))
    if hit_daily_limit:
        print("Stopped early: Groq daily token limit hit. Re-run this script later to resume.")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Spike: compare Exa summary vs. generate_relevant_sources.")
    parser.add_argument("--sample-size", type=int, default=10)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "exa_summary_spike_report.json"))
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    asyncio.run(run(args.sample_size, args.out))
