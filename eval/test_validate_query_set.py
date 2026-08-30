from validate_query_set import validate


def test_valid_set_has_no_errors():
    entries = [{"query": "redis caching strategies", "type": "broad"}] * 1
    errors = validate(entries, expected_counts={"broad": 1})
    assert errors == []


def test_flags_wrong_count_for_type():
    entries = [{"query": "a", "type": "broad"}]
    errors = validate(entries, expected_counts={"broad": 2})
    assert any("broad" in e for e in errors)


def test_flags_duplicate_query_text():
    entries = [{"query": "same query", "type": "broad"}, {"query": "same query", "type": "hard_negative"}]
    errors = validate(entries, expected_counts={"broad": 1, "hard_negative": 1})
    assert any("duplicate" in e.lower() for e in errors)


def test_flags_query_word_count_out_of_range():
    entries = [{"query": "a b c d e f g h i j k", "type": "broad"}]
    errors = validate(entries, expected_counts={"broad": 1})
    assert any("word count" in e.lower() for e in errors)


def test_flags_unexpected_type():
    entries = [{"query": "x", "type": "not_a_real_type"}]
    errors = validate(entries, expected_counts={"broad": 1})
    assert any("unexpected type" in e.lower() for e in errors)
