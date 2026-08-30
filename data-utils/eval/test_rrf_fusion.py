from rrf_fusion import build_ordered_semantic_results, merge_results


def test_consensus_doc_ranks_first_and_semantic_order_is_preserved():
    keyword_results = [{"uuid": "A", "title": "Lexical+Semantic"}]
    # Python's own rank order: A (also lexical), then B, then C.
    semantic_results = [{"uuid": "A"}, {"uuid": "B"}, {"uuid": "C"}]

    ordered = build_ordered_semantic_results(semantic_results, keyword_results)
    fused = merge_results(keyword_results, ordered)
    uuids = [item["uuid"] for item in fused]

    # Found by both legs -> must outrank semantic-only docs, not lose its semantic RRF term.
    assert uuids[0] == "A"
    # Semantic-only docs must keep Python's rank order (B before C).
    assert uuids.index("B") < uuids.index("C")


if __name__ == "__main__":
    test_consensus_doc_ranks_first_and_semantic_order_is_preserved()
    print("ok")

def test_semantic_weight_defaults_to_one_point_two_reverted_from_regressing_zero_point_eight():
    keyword_results = [{"uuid": "L"}]
    semantic_results = [{"uuid": "S"}]

    fused = merge_results(keyword_results, semantic_results)
    l_score = next(r["matchPercentage"] for r in fused if r["uuid"] == "L")
    s_score = next(r["matchPercentage"] for r in fused if r["uuid"] == "S")

    # Mirrors rankprocessor.unit.test.js's equivalent case. semanticWeight=0.8 was tried and
    # reverted: it helped 2-3 specific hard queries but regressed full-eval-set Precision@5
    # (0.4222 -> 0.3963, confirmed live) -- see subgoal2 artifact, Measure 1 reopened.
    assert s_score > l_score


def test_custom_lexical_weight():
    keyword_results = [{"uuid": "L"}]
    semantic_results = [{"uuid": "S"}]

    fused = merge_results(keyword_results, semantic_results, lexical_weight=0.5, semantic_weight=0.8)
    l_score = next(r["matchPercentage"] for r in fused if r["uuid"] == "L")
    s_score = next(r["matchPercentage"] for r in fused if r["uuid"] == "S")

    assert s_score > l_score
