from query_stats_for_authoring import broad_topic_candidates, sparse_topic_candidates


def _doc(uuid, title, hashtags):
    return {"uuid": uuid, "title": title, "hashtags": hashtags}


def test_broad_topic_candidate_needs_min_docs():
    records = [_doc(f"u{i}", f"Post {i} about caching", ["caching"]) for i in range(45)]
    candidates = broad_topic_candidates(records, flagged=set(), min_docs=40)
    assert any(c["hashtag"] == "caching" and c["doc_count"] == 45 for c in candidates)


def test_broad_topic_candidate_excludes_flagged_docs_from_count():
    records = [_doc(f"u{i}", f"Post {i} about caching", ["caching"]) for i in range(45)]
    flagged = {f"u{i}" for i in range(10)}
    candidates = broad_topic_candidates(records, flagged=flagged, min_docs=40)
    assert not any(c["hashtag"] == "caching" for c in candidates)  # 35 < 40 after exclusion


def test_sparse_topic_candidate_needs_low_doc_count():
    records = [_doc("u1", "Zig memory allocators explained", ["zig"])]
    candidates = sparse_topic_candidates(records, flagged=set(), max_docs=2)
    assert any("zig" in c["bigram"] for c in candidates)


def test_sparse_topic_excludes_bigrams_above_max_docs():
    records = [_doc(f"u{i}", "Common web framework tutorial", ["web"]) for i in range(5)]
    candidates = sparse_topic_candidates(records, flagged=set(), max_docs=2)
    assert not any("common web" in c["bigram"] for c in candidates)
