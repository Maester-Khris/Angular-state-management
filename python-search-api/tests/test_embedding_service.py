import os
os.environ.setdefault("QDRANT_URL", "http://test-qdrant")
os.environ.setdefault("QDRANT_API_KEY", "test-key")
os.environ.setdefault("QDRANT_COLLECTION_NAME", "test-collection")

from unittest.mock import MagicMock

from services.embedding_service import EmbeddingService


def test_search_similar_post_self_initializes_on_first_call(mocker):
    """Regression test: search_similar_post must not require a prior store_post()
    call to initialize — the old guard order made this permanently return []
    on a fresh process, even after the app's own startup warmup call."""
    svc = EmbeddingService()
    assert svc.client is None and svc.model is None

    mock_qdrant_cls = mocker.patch('services.embedding_service.QdrantClient')
    mock_qdrant_instance = mock_qdrant_cls.return_value
    mock_qdrant_instance.get_collections.return_value.collections = []

    mock_embed_cls = mocker.patch('services.embedding_service.TextEmbedding')
    mock_model_instance = mock_embed_cls.return_value
    mock_model_instance.embed.side_effect = lambda texts: [MagicMock(tolist=lambda: [0.1] * 384) for _ in texts]

    mock_hit = MagicMock()
    mock_hit.payload = {"uuid": "u1", "title": "t", "description": "d"}
    mock_hit.score = 0.9
    mock_qdrant_instance.query_points.return_value.points = [mock_hit]

    results = svc.search_similar_post("test query", limit=3)

    assert svc.client is not None
    assert svc.model is not None
    assert results == [{"uuid": "u1", "title": "t", "description": "d", "score": 0.9}]

from services.embedding_service import rrf_fuse

def test_rrf_fuse_union_keeps_hits_from_both_legs():
    """RRF must keep a doc that appears only in one leg (the memory case)."""
    raw = [
        {"uuid": "A", "title": "Memory Mgmt", "description": "heap gc", "score": 0.72},
        {"uuid": "B", "title": "React State",  "description": "hooks",   "score": 0.68},
    ]
    expanded = [
        {"uuid": "C", "title": "Garbage Collection", "description": "gc tuning", "score": 0.74},
        {"uuid": "B", "title": "React State",         "description": "hooks",    "score": 0.71},
    ]
    result = rrf_fuse(raw, expanded, k=60)
    uuids = [d["uuid"] for d in result]
    # A is only in raw, C is only in expanded -- both must survive
    assert "A" in uuids
    assert "C" in uuids
    # B appears in both -- should rank near the top
    assert "B" in uuids

def test_rrf_fuse_deduplicates_by_uuid():
    """A doc appearing in both legs must appear exactly once in the output."""
    raw = [{"uuid": "X", "title": "t", "description": "d", "score": 0.9}]
    expanded = [{"uuid": "X", "title": "t", "description": "d", "score": 0.85}]
    result = rrf_fuse(raw, expanded, k=60)
    assert len([d for d in result if d["uuid"] == "X"]) == 1

def test_rrf_fuse_ranks_overlap_doc_first():
    """A doc present in both legs gets double RRF score -- should outrank a doc in only one."""
    raw      = [{"uuid": "OVERLAP",  "title": "t",  "description": "d",  "score": 0.8},
                {"uuid": "ONLY_RAW", "title": "t2", "description": "d2", "score": 0.79}]
    expanded = [{"uuid": "OVERLAP",  "title": "t",  "description": "d",  "score": 0.8},
                {"uuid": "ONLY_EXP", "title": "t3", "description": "d3", "score": 0.79}]
    result = rrf_fuse(raw, expanded, k=60)
    assert result[0]["uuid"] == "OVERLAP"

def test_rrf_fuse_empty_expanded_returns_raw():
    """Graceful degradation when expanded_query leg returns nothing."""
    raw = [{"uuid": "A", "title": "t", "description": "d", "score": 0.7}]
    result = rrf_fuse(raw, [], k=60)
    assert [d["uuid"] for d in result] == ["A"]

def test_search_similar_post_passes_score_threshold_to_qdrant(mocker):
    """score_threshold must be forwarded to client.query_points when provided."""
    svc = EmbeddingService()

    mock_qdrant_cls = mocker.patch('services.embedding_service.QdrantClient')
    mock_qdrant = mock_qdrant_cls.return_value
    mock_qdrant.get_collections.return_value.collections = []
    mock_qdrant.query_points.return_value.points = []

    mock_embed_cls = mocker.patch('services.embedding_service.TextEmbedding')
    mock_model = mock_embed_cls.return_value
    mock_model.embed.side_effect = lambda texts: [
        type('E', (), {'tolist': lambda self: [0.1] * 384})() for _ in texts
    ]

    svc.search_similar_post("heap memory", limit=5, score_threshold=0.55)

    call_kwargs = mock_qdrant.query_points.call_args.kwargs
    assert call_kwargs.get("score_threshold") == 0.55

def test_search_similar_post_no_score_threshold_by_default(mocker):
    """When score_threshold is not given, query_points must receive None
    (Qdrant ignores None and returns all top-K -- existing behavior preserved)."""
    svc = EmbeddingService()

    mock_qdrant_cls = mocker.patch('services.embedding_service.QdrantClient')
    mock_qdrant = mock_qdrant_cls.return_value
    mock_qdrant.get_collections.return_value.collections = []
    mock_qdrant.query_points.return_value.points = []

    mock_embed_cls = mocker.patch('services.embedding_service.TextEmbedding')
    mock_model = mock_embed_cls.return_value
    mock_model.embed.side_effect = lambda texts: [
        type('E', (), {'tolist': lambda self: [0.1] * 384})() for _ in texts
    ]

    svc.search_similar_post("heap memory", limit=5)  # no score_threshold

    call_kwargs = mock_qdrant.query_points.call_args.kwargs
    assert call_kwargs.get("score_threshold") is None

import numpy as np
from services.embedding_service import mmr_rerank

def _make_doc(uuid, vec, score=0.8, relevance=1.0):
    """Helper: doc dict with a pre-computed embedding vector attached."""
    return {"uuid": uuid, "title": f"Title {uuid}", "description": "d", "score": score, "_vec": vec, "_relevance": relevance}

def test_mmr_rerank_suppresses_near_duplicate():
    """MMR must push a near-duplicate (same title cluster) behind a diverse doc."""
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [0.99, 0.14, 0.0]  # very close to A
    vec_c = [0.0, 1.0, 0.0]    # orthogonal to A

    docs = [
        _make_doc("A", vec_a, score=0.9, relevance=0.9),
        _make_doc("B", vec_b, score=0.88, relevance=0.88),
        _make_doc("C", vec_c, score=0.85, relevance=0.85),
    ]

    result = mmr_rerank(docs, lambda_param=0.5)
    uuids = [d["uuid"] for d in result]

    assert uuids[0] == "A"
    assert uuids.index("C") < uuids.index("B"), (
        "Diverse doc C must rank ahead of near-duplicate B after MMR"
    )

def test_mmr_rerank_lambda_1_is_pure_relevance():
    """With lambda_param=1.0 (ignore diversity), output order == input order."""
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [0.99, 0.14, 0.0]
    docs = [_make_doc("A", vec_a, score=0.9, relevance=0.9), _make_doc("B", vec_b, score=0.88, relevance=0.88)]
    result = mmr_rerank(docs, lambda_param=1.0)
    assert [d["uuid"] for d in result] == ["A", "B"]

def test_mmr_rerank_preserves_all_docs():
    """mmr_rerank must return all input docs (MMR is a reorder, not a filter)."""
    vecs = [[1.0, 0.0], [0.0, 1.0], [0.7, 0.7]]
    docs = [_make_doc(str(i), v) for i, v in enumerate(vecs)]
    result = mmr_rerank(docs, lambda_param=0.5)
    assert len(result) == 3

def test_mmr_rerank_empty_input():
    """mmr_rerank with no docs must return []."""
    result = mmr_rerank([], lambda_param=0.5)
    assert result == []

def test_mmr_rerank_single_doc_returns_it():
    """Single-element input must be returned unchanged."""
    doc = _make_doc("only", [1.0, 0.0])
    result = mmr_rerank([doc], lambda_param=0.5)
    assert len(result) == 1
    assert result[0]["uuid"] == "only"

def test_mmr_rerank_strips_internal_keys():
    """_vec and _relevance must not appear in output dicts -- internal keys only."""
    docs = [_make_doc("A", [1.0, 0.0]), _make_doc("B", [0.0, 1.0])]
    result = mmr_rerank(docs, lambda_param=0.5)
    for doc in result:
        assert "_vec" not in doc, "_vec must be stripped"
        assert "_relevance" not in doc, "_relevance must be stripped"

def test_mmr_rerank_missing_vec():
    """Docs missing _vec should not crash, treated as 0 redundancy."""
    doc_with_vec = _make_doc("A", [1.0, 0.0], relevance=0.8)
    doc_without = {"uuid": "B", "score": 0.7, "_relevance": 0.7} # Missing _vec
    result = mmr_rerank([doc_with_vec, doc_without], lambda_param=0.5)
    assert len(result) == 2
    assert result[0]["uuid"] == "A"

def test_mmr_rerank_missing_relevance():
    """Docs missing _relevance should default to 0.0."""
    doc_with_rel = _make_doc("A", [1.0, 0.0], relevance=0.8)
    doc_without = {"uuid": "B", "_vec": [0.0, 1.0], "score": 0.7} # Missing _relevance
    result = mmr_rerank([doc_with_rel, doc_without], lambda_param=0.5)
    assert len(result) == 2
    assert result[0]["uuid"] == "A"
    assert result[1]["uuid"] == "B"
