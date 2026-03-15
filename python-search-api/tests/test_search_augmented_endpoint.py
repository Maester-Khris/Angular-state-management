import pytest
from unittest.mock import AsyncMock

def test_search_augmented_still_responds(client, auth_headers, mock_embedding_svc, mock_inference_svc, fake_qdrant_docs):
    """Valid { query } -> not 404 (endpoint still exists and works)"""
    mock_embedding_svc.search_similar_post.return_value = fake_qdrant_docs
    mock_inference_svc.generate_relevant_sources = AsyncMock(return_value=[])
    
    payload = {"query": "deprecated test"}
    response = client.post('/search-augmented', json=payload, headers=auth_headers)
    
    assert response.status_code != 404
    assert response.status_code == 200

def test_search_augmented_no_auth(client):
    """No auth -> 401"""
    response = client.post('/search-augmented', json={"query": "q"})
    assert response.status_code == 401
