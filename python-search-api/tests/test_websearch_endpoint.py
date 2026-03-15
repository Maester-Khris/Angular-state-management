import pytest
from unittest.mock import AsyncMock

def test_websearch_success(client, auth_headers, mock_websearch_svc, fake_web_results):
    """Valid { query } -> 200, check response shape."""
    mock_websearch_svc.search = AsyncMock(return_value=fake_web_results)
    
    payload = {"query": "test websearch"}
    response = client.post('/web-search', json=payload, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['query'] == "test websearch"
    assert data['count'] == 3
    assert len(data['results']) == 3
    assert data['results'][0]['title'] == "AI News"

def test_websearch_missing_query(client, auth_headers):
    """Missing query -> 400"""
    response = client.post('/web-search', json={}, headers=auth_headers)
    assert response.status_code == 400

def test_websearch_no_auth(client):
    """No auth -> 401"""
    response = client.post('/web-search', json={"query": "q"})
    assert response.status_code == 401
