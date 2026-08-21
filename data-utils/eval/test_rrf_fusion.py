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
