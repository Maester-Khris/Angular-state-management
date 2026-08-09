import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'data-utils'))
from eval.metrics import format_compliant, precision_at_k, recall_at_k


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
