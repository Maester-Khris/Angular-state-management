import os
os.environ.setdefault("QDRANT_URL", "http://test-qdrant")
os.environ.setdefault("QDRANT_API_KEY", "test-key")
os.environ.setdefault("QDRANT_COLLECTION_NAME", "test-collection")

from unittest.mock import MagicMock
from services.reranking_service import RerankingService


SAMPLE_DOCS = [
    {"uuid": "a1", "title": "Redis Caching",   "description": "LRU cache eviction policy",    "score": 0.70},
    {"uuid": "a2", "title": "Kubernetes Pods", "description": "pod scheduling and resources",  "score": 0.68},
    {"uuid": "a3", "title": "GC Tuning",       "description": "heap garbage collection JVM",  "score": 0.66},
]


def test_reranking_service_lazy_loads_on_first_rerank():
    """Reranker must not load the model until rerank() is first called."""
    svc = RerankingService()
    assert svc.reranker is None


def test_rerank_returns_same_docs_in_different_order(mocker):
    """rerank() must return all input docs, possibly reordered."""
    svc = RerankingService()

    mock_encoder_cls = mocker.patch('services.reranking_service.TextCrossEncoder')
    mock_encoder = mock_encoder_cls.return_value
    # Simulate: cross-encoder scores GC doc (a3) highest for "memory management" query
    mock_encoder.rerank.return_value = iter([0.2, 0.1, 0.9])

    result = svc.rerank("memory management", SAMPLE_DOCS)

    assert len(result) == 3
    result_uuids = [d["uuid"] for d in result]
    assert set(result_uuids) == {"a1", "a2", "a3"}
    # GC Tuning (a3, cross-encoder score 0.9) must be first
    assert result[0]["uuid"] == "a3"


def test_rerank_empty_input_returns_empty():
    """rerank() with no candidates must return [] without touching the model."""
    svc = RerankingService()
    result = svc.rerank("any query", [])
    assert result == []
    assert svc.reranker is None  # model must not have loaded


def test_rerank_initializes_model_with_threads_1(mocker):
    """threads=1 is required on hobby-tier; verify it's passed to TextCrossEncoder."""
    svc = RerankingService()

    mock_encoder_cls = mocker.patch('services.reranking_service.TextCrossEncoder')
    mock_encoder_cls.return_value.rerank.return_value = iter([0.5, 0.4, 0.3])

    svc.rerank("cache", SAMPLE_DOCS)

    call_kwargs = mock_encoder_cls.call_args.kwargs
    assert call_kwargs.get("threads") == 1


def test_rerank_preserves_original_doc_fields(mocker):
    """rerank() must return the original doc dicts unmodified (uuid, title, description, score)."""
    svc = RerankingService()

    mock_encoder_cls = mocker.patch('services.reranking_service.TextCrossEncoder')
    mock_encoder_cls.return_value.rerank.return_value = iter([0.8, 0.3, 0.1])

    result = svc.rerank("redis", SAMPLE_DOCS)

    # Top result should be a1 (cross-encoder score 0.8) -- check fields intact
    assert result[0]["uuid"] == "a1"
    assert result[0]["title"] == "Redis Caching"
    assert result[0]["description"] == "LRU cache eviction policy"
    assert "score" in result[0]  # original cosine score field preserved
