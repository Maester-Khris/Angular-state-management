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
