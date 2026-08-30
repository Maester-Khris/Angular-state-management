import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'data-utils'))
from eval.rrf_fusion import filter_missing_from_lexical, merge_results


def test_filter_missing_from_lexical_removes_overlap():
    keyword_results = [{"uuid": "a"}]
    semantic_results = [{"uuid": "a"}, {"uuid": "b"}, {"uuid": "c"}]
    result = filter_missing_from_lexical(semantic_results, keyword_results)
    assert [item["uuid"] for item in result] == ["b", "c"]


def test_filter_missing_from_lexical_no_overlap():
    keyword_results = [{"uuid": "x"}]
    semantic_results = [{"uuid": "a"}, {"uuid": "b"}]
    result = filter_missing_from_lexical(semantic_results, keyword_results)
    assert [item["uuid"] for item in result] == ["a", "b"]


def test_merge_results_empty_inputs_returns_empty():
    assert merge_results([], []) == []


def test_merge_results_rrf_ranking_and_match_percentage():
    # Hand-computed against rankprocessor.js's exact formula, k=60, semanticWeight=1.2:
    #   keyword: a rank1 -> 1/61        = 0.0163934...
    #            b rank2 -> 1/62        = 0.0161290...
    #   semantic: b rank1 -> 1.2/61     = 0.0196721...
    #             c rank2 -> 1.2/62     = 0.0193548...
    #   combined: a=0.0163934, b=0.0161290+0.0196721=0.0358011, c=0.0193548
    #   sorted desc: b, c, a -- max=b's score, min=a's score
    #   matchPercentage: b=100, c=round(0.0193548/0.0358011*100)=54, a=round(0.0163934/0.0358011*100)=46
    keyword_results = [{"uuid": "a"}, {"uuid": "b"}]
    semantic_results = [{"uuid": "b"}, {"uuid": "c"}]

    result = merge_results(keyword_results, semantic_results)

    assert [item["uuid"] for item in result] == ["b", "c", "a"]
    assert [item["matchPercentage"] for item in result] == [100, 54, 46]
    assert "combinedScore" not in result[0]


def test_merge_results_dedup_last_occurrence_wins_item_payload():
    # Mirrors JS's `new Map(allItems.map(item => [item.uuid, item])).values()` --
    # last occurrence in [...keywordResults, ...semanticResults] wins the stored item dict.
    keyword_results = [{"uuid": "a", "title": "keyword-version"}]
    semantic_results = [{"uuid": "a", "title": "semantic-version"}]

    result = merge_results(keyword_results, semantic_results)

    assert len(result) == 1
    assert result[0]["title"] == "semantic-version"
