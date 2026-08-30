import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'data-utils'))
from eval.metrics import format_compliant, ndcg_at_k, precision_at_k, recall_at_k


def test_precision_at_k_all_relevant():
    assert precision_at_k(["a", "b", "c"], {"a", "b", "c"}, k=3) == 1.0

def test_precision_at_k_partial():
    assert precision_at_k(["a", "x", "c"], {"a", "b", "c"}, k=3) == pytest.approx(2 / 3)

def test_recall_at_k_partial():
    assert recall_at_k(["a", "x"], {"a", "b", "c"}, k=2) == pytest.approx(1 / 3)

def test_format_compliant_within_limit():
    assert format_compliant("caching redis ttl invalidation strategy", max_keywords=8) is True

def test_format_compliant_too_many_keywords():
    assert format_compliant("one two three four five six seven eight nine", max_keywords=8) is False

def test_format_compliant_rejects_punctuation():
    assert format_compliant("caching, redis, and TTL invalidation.", max_keywords=8) is False

def test_ndcg_at_k_perfect_ranking():
    # ndcg_at_k takes graded relevance (dict of doc_id -> grade); grade=1 for every relevant
    # doc reduces the 2^rel-1 gain formula to classic binary nDCG.
    retrieved = ["a", "b", "c"]
    relevance = {"a": 1, "b": 1, "c": 1}
    assert ndcg_at_k(retrieved, relevance, k=3) == pytest.approx(1.0)

def test_ndcg_at_k_no_relevant_set():
    assert ndcg_at_k(["a", "b"], {}, k=2) == 0.0

def test_ndcg_at_k_no_hits():
    retrieved = ["x", "y"]
    relevance = {"a": 1}
    assert ndcg_at_k(retrieved, relevance, k=2) == 0.0

def test_ndcg_at_k_partial_out_of_order():
    retrieved = ["x", "a", "b"]
    relevance = {"a": 1, "b": 1, "c": 1}
    # dcg = 0/log2(2) + 1/log2(3) + 1/log2(4) = 0 + 0.63093 + 0.5 = 1.13093
    # idcg (min(3,3)=3 ideal hits) = 1/log2(2) + 1/log2(3) + 1/log2(4) = 1 + 0.63093 + 0.5 = 2.13093
    assert ndcg_at_k(retrieved, relevance, k=3) == pytest.approx(1.13093 / 2.13093, rel=1e-4)
