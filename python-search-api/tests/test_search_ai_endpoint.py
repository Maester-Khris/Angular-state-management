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
    assert data['degraded_legs'] == []

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

def test_search_ai_qdrant_failure_still_500s(client, auth_headers, mock_embedding_svc):
    """Qdrant (core retrieval) failure stays a hard failure — not degraded."""
    mock_embedding_svc.search_similar_post_async = AsyncMock(side_effect=Exception("Qdrant unavailable"))
    response = client.post('/search/ai', json={"query": "fail"}, headers=auth_headers)
    assert response.status_code == 500
    assert "error" in response.get_json()

def test_search_ai_expansion_failure_degrades_not_500(client, auth_headers, mock_embedding_svc,
                                                        mock_inference_svc, mock_websearch_svc,
                                                        fake_qdrant_docs, fake_web_results, fake_structured_sources):
    """Expansion failure -> 200, falls back to original query, marked degraded."""
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)
    mock_inference_svc.expand_query = AsyncMock(side_effect=Exception("Groq timeout"))
    mock_websearch_svc.search = AsyncMock(return_value=fake_web_results)
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=fake_structured_sources)

    response = client.post('/search/ai', json={"query": "fail case"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['expanded_query'] == "fail case"
    assert "expansion" in data['degraded_legs']

def test_search_ai_websearch_failure_degrades_not_500(client, auth_headers, mock_embedding_svc,
                                                        mock_inference_svc, mock_websearch_svc,
                                                        fake_qdrant_docs):
    """Web search failure -> 200, relevant_ext_docs empty, marked degraded."""
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)
    mock_inference_svc.expand_query = AsyncMock(return_value="exp")
    mock_websearch_svc.search = AsyncMock(side_effect=Exception("Exa MCP timeout"))
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=[])

    response = client.post('/search/ai', json={"query": "fail case"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['relevant_ext_docs'] == []
    assert "web_search" in data['degraded_legs']

def test_search_ai_websearch_empty_result_degrades_not_500(client, auth_headers, mock_embedding_svc,
                                                             mock_inference_svc, mock_websearch_svc,
                                                             fake_qdrant_docs):
    """Web search returning [] (the adapter's real never-throw contract) -> 200, marked degraded."""
    mock_embedding_svc.search_similar_post_async = AsyncMock(return_value=fake_qdrant_docs)
    mock_inference_svc.expand_query = AsyncMock(return_value="exp")
    mock_websearch_svc.search = AsyncMock(return_value=[])
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=[])

    response = client.post('/search/ai', json={"query": "fail case"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['relevant_ext_docs'] == []
    assert "web_search" in data['degraded_legs']

@pytest.mark.asyncio
async def test_pipeline_calls_second_qdrant_leg_with_expanded_query(
    mock_embedding_svc, mock_inference_svc, mock_websearch_svc
):
    """_search_ai_pipeline must issue a second search call using expanded_query
    and pass both result lists through rrf_fuse -- not just return raw results."""
    from app import _search_ai_pipeline

    mock_inference_svc.expand_query = AsyncMock(return_value="heap garbage collection memory management")
    mock_websearch_svc.search = AsyncMock(return_value=[])
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=[])

    raw_docs = [{"uuid": "raw-only", "title": "Redis", "description": "cache", "score": 0.72}]
    expanded_docs = [{"uuid": "exp-only", "title": "GC Tuning", "description": "gc", "score": 0.75}]

    call_count = {"n": 0}
    async def fake_search(query, limit):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return raw_docs
        return expanded_docs

    mock_embedding_svc.search_similar_post_async = fake_search

    result = await _search_ai_pipeline("memory", limit=5)

    # Both legs must survive fusion
    uuids = [d["uuid"] for d in result["similar_docs"]]
    assert "raw-only" in uuids, "raw-query hit must survive RRF fusion"
    assert "exp-only" in uuids, "expanded-query hit must survive RRF fusion"
    # Two Qdrant calls must have been made
    assert call_count["n"] == 2, "pipeline must issue two Qdrant search calls"
