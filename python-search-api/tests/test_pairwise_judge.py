# (placed under python-search-api/tests so it can reuse the existing pytest-asyncio setup;
# eval/pairwise_judge.py itself stays a standalone eval script per data-utils convention)
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "eval"))

import pytest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("GROQ_API_KEY", "test-groq-key")

from pairwise_judge import compare_swap_augmented


@pytest.mark.asyncio
async def test_compare_swap_augmented_agreeing_orders_returns_that_winner():
    # Both calls (old-first and new-first) agree "new" wins on faithfulness, tie on relevance
    responses = [
        {"faithfulness_winner": "b", "answer_relevance_winner": "tie", "reasoning": "..."},  # old=a,new=b -> new wins faithfulness
        {"faithfulness_winner": "a", "answer_relevance_winner": "tie", "reasoning": "..."},  # new=a,old=b -> new(a) wins faithfulness
    ]
    with patch("pairwise_judge.judge_pair", new=AsyncMock(side_effect=responses)):
        result = await compare_swap_augmented("q", "ctx", {"id": "old"}, {"id": "new"})
    assert result == {"faithfulness": "new", "answer_relevance": "tie"}


@pytest.mark.asyncio
async def test_compare_swap_augmented_disagreeing_orders_returns_tie():
    responses = [
        {"faithfulness_winner": "a", "answer_relevance_winner": "a", "reasoning": "..."},  # old-first: old wins both
        {"faithfulness_winner": "a", "answer_relevance_winner": "b", "reasoning": "..."},  # new-first: new wins faithfulness(a), old wins relevance(b)
    ]
    with patch("pairwise_judge.judge_pair", new=AsyncMock(side_effect=responses)):
        result = await compare_swap_augmented("q", "ctx", {"id": "old"}, {"id": "new"})
    # order 1 says old wins faithfulness; order 2 says new wins faithfulness -> disagreement -> tie
    assert result["faithfulness"] == "tie"
