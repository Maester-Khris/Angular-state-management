# eval/pairwise_judge.py
# Usage: import judge_pair / compare_swap_augmented from spike_exa_summary_vs_reranking.py
# Requires: GROQ_API_KEY in environment
#
# Swap-augmented pairwise LLM judge for the Exa-summary-vs-reranking spike. Implements
# artifacts/ai-search-upgrade/evaluation-metrics-and-methodology.md Part B2's bias mitigations:
# swap augmentation (score both presentation orders, disagreement -> tie), calibration prompting
# (explicit order/length-bias instruction below), chain-of-thought forcing (reasoning required
# before the verdict fields in the JSON response).
#
# Deliberately NOT the `ragas` pip package -- direct Groq call, matching the proven pattern in
# judge_candidate_pools.py, consistent with this project's dependency-minimalism.

import json
import os

from groq import AsyncGroq

GROQ_MODEL = os.getenv("PYTHON_LLM_MODEL", "openai/gpt-oss-120b")
# openai/gpt-oss-120b is a reasoning model -- starts generous per this sprint's earlier
# empirical lesson (32 silently emptied expand_query's output; 400 wasn't enough for wide
# candidate pools in judge_candidate_pools.py). This prompt is short and single-verdict, but
# starting low again after two prior failures on the same root cause isn't worth repeating.
MAX_TOKENS = 2000

_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are comparing two candidate outputs (A and B) for the same web-search
result, judging two independent qualities:

1. Faithfulness: is the output actually grounded in the provided source context, or does it
   invent/hallucinate details not present in the context?
2. Answer Relevance: does the output actually address the user's query, or is it generic/
   off-topic?

Judge each quality independently -- a candidate can win on one and lose on the other.

IMPORTANT — do not let presentation order or response length influence your judgment. A longer
or first-shown answer is not automatically better. Judge only on faithfulness and relevance as
defined above.

First write your reasoning, THEN give your verdicts. Return ONLY this JSON shape, no markdown
fences, no other text:
{"reasoning": "...", "faithfulness_winner": "a"|"b"|"tie", "answer_relevance_winner": "a"|"b"|"tie"}
"""


async def judge_pair(query: str, context: str, answer_a: dict, answer_b: dict) -> dict:
    user_prompt = f"""Query: "{query}"

Source context (what the candidates should be faithful to):
{context}

Candidate A:
Headline: {answer_a.get('source_small_headline', '')}
Description: {answer_a.get('source_small_description', '')}

Candidate B:
Headline: {answer_b.get('source_small_headline', '')}
Description: {answer_b.get('source_small_description', '')}
"""
    response = await _client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.0,
        max_tokens=MAX_TOKENS,
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def _resolve_winner(order1_winner: str, order1_new_slot: str, order2_winner: str, order2_new_slot: str) -> str:
    """Maps each order's a/b/tie verdict back to old/new/tie, then applies B2's
    disagreement-is-a-tie rule."""
    def to_old_new(winner: str, new_slot: str) -> str:
        if winner == "tie":
            return "tie"
        old_slot = "b" if new_slot == "a" else "a"
        return "new" if winner == new_slot else "old"

    r1 = to_old_new(order1_winner, order1_new_slot)
    r2 = to_old_new(order2_winner, order2_new_slot)
    return r1 if r1 == r2 else "tie"


async def compare_swap_augmented(query: str, context: str, candidate_old: dict, candidate_new: dict) -> dict:
    # Order 1: old=A, new=B
    order1 = await judge_pair(query, context, candidate_old, candidate_new)
    # Order 2: new=A, old=B (swapped)
    order2 = await judge_pair(query, context, candidate_new, candidate_old)

    return {
        "faithfulness": _resolve_winner(
            order1["faithfulness_winner"], "b", order2["faithfulness_winner"], "a"
        ),
        "answer_relevance": _resolve_winner(
            order1["answer_relevance_winner"], "b", order2["answer_relevance_winner"], "a"
        ),
    }
