import pytest

def test_root_returns_200(client):
    """GET / -> 200, body contains 'status': 'online'"""
    response = client.get('/')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'online'
    assert 'PostAir Semantic Search Engine' in data['message']

def test_health_returns_200(client):
    """GET /health -> 200, body contains 'status': 'OK'"""
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'OK'
    assert data['service'] == 'postair-search-api'
