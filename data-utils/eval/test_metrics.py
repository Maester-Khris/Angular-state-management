from metrics import mrr, ndcg_at_k, precision_at_k, r_precision, recall_at_k


def test_precision_at_k_unchanged_behavior():
    assert precision_at_k(["a", "b", "c"], {"a", "c"}, 3) == 2 / 3


def test_recall_at_k_unchanged_behavior():
    assert recall_at_k(["a", "b"], {"a", "c"}, 2) == 0.5


def test_ndcg_graded_perfect_ranking_scores_one():
    relevance = {"a": 2, "b": 1}
    assert ndcg_at_k(["a", "b", "c"], relevance, 3) == 1.0


def test_ndcg_graded_rewards_putting_grade_2_first():
    relevance = {"a": 2, "b": 1}
    worse_order = ndcg_at_k(["b", "a", "c"], relevance, 3)
    assert worse_order < 1.0


def test_ndcg_no_relevant_docs_returns_zero():
    assert ndcg_at_k(["a", "b"], {}, 5) == 0.0


def test_mrr_rewards_first_hit_position():
    assert mrr(["x", "a", "b"], {"a"}) == 1 / 2
    assert mrr(["a", "x", "b"], {"a"}) == 1.0


def test_mrr_no_hit_is_zero():
    assert mrr(["x", "y"], {"a"}) == 0.0


def test_r_precision_uses_relevant_count_as_k():
    # 3 relevant docs total -> R-precision looks at top-3
    assert r_precision(["a", "x", "b", "c"], {"a", "b", "c"}) == 2 / 3


def test_r_precision_no_relevant_docs_is_zero():
    assert r_precision(["a", "b"], set()) == 0.0
