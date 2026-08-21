from compute_agreement_v2 import binarize, compute_from_dicts


def test_binarize_treats_any_nonzero_grade_as_relevant():
    judgments = [{"uuid": "a", "relevance": 1}, {"uuid": "b", "relevance": 2}]
    assert binarize(judgments) == {"a", "b"}


def test_binarize_empty_judgments_is_empty_set():
    assert binarize([]) == set()


def test_compute_from_dicts_flags_full_agreement():
    a = {"q1": {"judgments": [{"uuid": "x", "relevance": 1, "rationale": "r1"}]}}
    b = {"q1": {"judgments": [{"uuid": "x", "relevance": 2, "rationale": "r2"}]}}
    report = compute_from_dicts(a, b)
    assert report["per_query"]["q1"]["jaccard"] == 1.0
    assert report["disagreements"] == []


def test_compute_from_dicts_flags_relevance_disagreement_with_rationales():
    a = {"q1": {"judgments": [{"uuid": "x", "relevance": 1, "rationale": "openai says relevant"}]}}
    b = {"q1": {"judgments": []}}
    report = compute_from_dicts(a, b)
    assert report["per_query"]["q1"]["jaccard"] == 0.0
    assert len(report["disagreements"]) == 1
    d = report["disagreements"][0]
    assert d["uuid"] == "x" and d["a_relevant"] is True and d["b_relevant"] is False
    assert d["a_rationale"] == "openai says relevant"


def test_compute_from_dicts_grade_conflict_both_relevant_different_grade():
    a = {"q1": {"judgments": [{"uuid": "x", "relevance": 1, "rationale": "r1"}]}}
    b = {"q1": {"judgments": [{"uuid": "x", "relevance": 2, "rationale": "r2"}]}}
    report = compute_from_dicts(a, b)
    assert report["grade_conflicts"] == [{"query": "q1", "uuid": "x", "a_grade": 1, "b_grade": 2}]
