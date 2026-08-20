# eval/spike_exa_summary_vs_reranking.py
# Usage: python spike_exa_summary_vs_reranking.py [--sample-size 10] [--out report.json]
# Requires: GROQ_API_KEY, EXA_API_KEY in environment
#
# One-off spike comparison for Phase 9 (docs/superpowers/plans/2026-08-09-ai-search-pipeline-
# upgrade.md) / docs/superpowers/plans/2026-08-19-exa-summary-vs-reranking-spike.md's Task 5
# decision gate. For a sample of the finalized golden set: runs live Exa web search once per
# query, feeds the identical results into both generate_relevant_sources (old, Groq) and
# ExaSourceSummaryAdapter.summarize (new, Exa REST /contents), then scores the pair with the
# swap-augmented judge. Not resumable -- deliberately small (default 10 queries x 2 judge calls
# = 20 Groq calls total), well inside a single day's TPD even on the tightest observed limit
# this sprint (200000/day).

import argparse
import asyncio
import json
import os
import random
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "python-search-api"))

from dotenv import load_dotenv
from pairwise_judge import compare_swap_augmented
from services.inference import InferenceService
from services.search_providers.exa_provider import ExaWebSearchAdapter
from services.search_providers.exa_summary_provider import ExaSourceSummaryAdapter

load_dotenv()


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


async def run(sample_size: int, out_path: str) -> dict:
    golden_path = os.path.join(os.path.dirname(__file__), "golden_queries_30k.json")
    sample = load_sample(golden_path, sample_size)

    websearch_svc = ExaWebSearchAdapter()
    llm_svc = InferenceService()
    summary_svc = ExaSourceSummaryAdapter()

    results = []
    for i, entry in enumerate(sample, start=1):
        query = entry["query"]
        print(f"[{i}/{len(sample)}] {query}")

        web_results = await websearch_svc.search(query, limit=8)
        if not web_results:
            print("  no web results, skipping")
            continue

        web_dicts = to_web_result_dicts(web_results)
        old_sources = await llm_svc.generate_relevant_sources(query, web_dicts)
        new_sources = summary_svc.summarize(query, web_dicts)  # sync -- REST call, not MCP

        if not old_sources or not new_sources:
            print(f"  incomplete output (old={len(old_sources)}, new={len(new_sources)}), skipping")
            continue

        context = build_context(web_results)
        # Compare the top source from each side -- the decision gate cares about overall output
        # quality per query, not a full cross-product of every source pair.
        verdict = await compare_swap_augmented(query, context, old_sources[0], new_sources[0])
        results.append({"query": query, "verdict": verdict})

    faithfulness_tally = {"old": 0, "new": 0, "tie": 0}
    relevance_tally = {"old": 0, "new": 0, "tie": 0}
    for r in results:
        faithfulness_tally[r["verdict"]["faithfulness"]] += 1
        relevance_tally[r["verdict"]["answer_relevance"]] += 1

    report = {
        "sample_size": len(results),
        "faithfulness_tally": faithfulness_tally,
        "answer_relevance_tally": relevance_tally,
        "results": results,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nWrote report to {out_path}")
    print(json.dumps({"faithfulness": faithfulness_tally, "answer_relevance": relevance_tally}, indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Spike: compare Exa summary vs. generate_relevant_sources.")
    parser.add_argument("--sample-size", type=int, default=10)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "exa_summary_spike_report.json"))
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    asyncio.run(run(args.sample_size, args.out))
