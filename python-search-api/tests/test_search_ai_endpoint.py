import pytest
import asyncio
from unittest.mock import AsyncMock

from services.search_providers.base import WebResult

def test_search_ai_success(client, auth_headers, mock_embedding_svc, mock_inference_svc, mock_websearch_svc,
                           fake_qdrant_docs, fake_web_results, fake_structured_sources):
    """
    Valid { query } -> 200
    Verifies the full pipeline: Qdrant -> LLM Expand -> Web Search -> LLM Structure.
    """
    # Setup Mocks
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)

    # expand_query and generate_relevant_sources are awaited inside one asyncio.run()
    mock_inference_svc.expand_query = AsyncMock(return_value="expanded search string")
    mock_websearch_svc.search = AsyncMock(return_value=fake_web_results)
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=fake_structured_sources)
    
    payload = {"query": "test ai query", "limit": 5}
    response = client.post('/search/ai', json=payload, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    
    assert data['query'] == "test ai query"
    assert data['expanded_query'] == "expanded search string"
    assert len(data['similar_docs']) == 3
    assert len(data['relevant_ext_docs']) == 2
    assert data['relevant_ext_docs'][0]['source_name'] == "AI News"

    # Verify pipeline wiring
    mock_inference_svc.expand_query.assert_called_once()
    mock_websearch_svc.search.assert_called_once_with("expanded search string", limit=8)
    mock_inference_svc.generate_relevant_sources.assert_called_once()

def test_search_ai_uses_single_event_loop(client, auth_headers, mocker, mock_embedding_svc,
                                           mock_inference_svc, mock_websearch_svc,
                                           fake_qdrant_docs, fake_web_results, fake_structured_sources):
    """search_ai() must spin up exactly one event loop, not three."""
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)
    mock_inference_svc.expand_query = AsyncMock(return_value="expanded search string")
    mock_websearch_svc.search = AsyncMock(return_value=fake_web_results)
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=fake_structured_sources)

    spy = mocker.spy(asyncio, 'run')
    response = client.post('/search/ai', json={"query": "test", "limit": 5}, headers=auth_headers)

    assert response.status_code == 200
    assert spy.call_count == 1

def test_search_ai_maps_web_result_objects_to_dicts_for_reranking(client, auth_headers, mock_embedding_svc,
                                                                    mock_inference_svc, mock_websearch_svc,
                                                                    fake_qdrant_docs, fake_structured_sources):
    """Regression test: websearch_svc.search() returns list[WebResult] (dataclass,
    'snippet' field), but generate_relevant_sources expects list[dict] with a
    'description' key — the pipeline must translate between them, not pass
    WebResult objects straight through (they have no .get(), and no 'description')."""
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)
    mock_inference_svc.expand_query = AsyncMock(return_value="expanded search string")
    mock_websearch_svc.search = AsyncMock(return_value=[
        WebResult(title="Redis Guide", url="https://x.com", favicon="https://x.com/f.ico", snippet="About Redis"),
    ])
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=fake_structured_sources)

    response = client.post('/search/ai', json={"query": "test", "limit": 5}, headers=auth_headers)

    assert response.status_code == 200
    call_args = mock_inference_svc.generate_relevant_sources.call_args
    passed_web_results = call_args[0][1]
    assert passed_web_results == [
        {"title": "Redis Guide", "url": "https://x.com", "favicon": "https://x.com/f.ico", "description": "About Redis"}
    ]

def test_search_ai_missing_query(client, auth_headers):
    """{} body -> 400"""
    response = client.post('/search/ai', json={}, headers=auth_headers)
    assert response.status_code == 400

def test_search_ai_no_auth(client):
    """No auth -> 401"""
    response = client.post('/search/ai', json={"query": "q"})
    assert response.status_code == 401

def test_search_ai_qdrant_failure(client, auth_headers, mock_embedding_svc):
    """Qdrant failure -> 500"""
    mock_embedding_svc.search_similar_post_async = AsyncMock(side_effect=Exception("Qdrant unavailable"))
    response = client.post('/search/ai', json={"query": "fail"}, headers=auth_headers)
    assert response.status_code == 500
    assert "error" in response.get_json()

def test_search_ai_llm_failure(client, auth_headers, mock_embedding_svc, mock_inference_svc, fake_qdrant_docs):
    """LLM expansion failure -> 500"""
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)
    mock_inference_svc.expand_query = AsyncMock(side_effect=Exception("Groq timeout"))

    response = client.post('/search/ai', json={"query": "fail"}, headers=auth_headers)
    assert response.status_code == 500

def test_search_ai_websearch_failure(client, auth_headers, mock_embedding_svc, mock_inference_svc,
                                     mock_websearch_svc, fake_qdrant_docs):
    """Websearch failure -> 500"""
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)
    mock_inference_svc.expand_query = AsyncMock(return_value="exp")
    mock_websearch_svc.search = AsyncMock(side_effect=Exception("SerpAPI 403"))

    response = client.post('/search/ai', json={"query": "fail"}, headers=auth_headers)
    assert response.status_code == 500
