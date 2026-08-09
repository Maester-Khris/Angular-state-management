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
