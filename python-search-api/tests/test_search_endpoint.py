import pytest

def test_search_success(client, auth_headers, mock_embedding_svc, fake_qdrant_docs):
    """Valid { query } -> 200, check response shape and mock interaction."""
    mock_embedding_svc.search_similar_post.return_value = fake_qdrant_docs[:2]
    
    payload = {"query": "test query", "limit": 2}
    response = client.post('/search', json=payload, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['query'] == "test query"
    assert data['count'] == 2
    assert len(data['results']) == 2
    assert data['results'][0]['uuid'] == "uuid-1"

def test_search_missing_query(client, auth_headers):
    """{} body -> 400"""
    response = client.post('/search', json={}, headers=auth_headers)
    assert response.status_code == 400
    assert "error" in response.get_json()

def test_search_no_auth(client):
    """No auth -> 401"""
    response = client.post('/search', json={"query": "q"})
    assert response.status_code == 401

def test_search_respects_limit(client, auth_headers, mock_embedding_svc, fake_qdrant_docs):
    """{ query, limit: 3 } -> assert mock was called with limit=3"""
    mock_embedding_svc.search_similar_post.return_value = fake_qdrant_docs
    
    payload = {"query": "testing limit", "limit": 3}
    client.post('/search', json=payload, headers=auth_headers)
    
    mock_embedding_svc.search_similar_post.assert_called_once_with("testing limit", limit=3)
