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

def test_ping_returns_200_when_qdrant_up(client, mocker):
    """GET /ping -> 200 when Qdrant round trip succeeds."""
    mocker.patch('app.search_svc.ping', return_value=True)
    response = client.get('/ping')
    assert response.status_code == 200
    data = response.get_json()
    assert data['qdrant'] == 'up'

def test_ping_returns_503_when_qdrant_down(client, mocker):
    """GET /ping -> 503 when Qdrant round trip raises."""
    mocker.patch('app.search_svc.ping', side_effect=Exception('cluster paused'))
    response = client.get('/ping')
    assert response.status_code == 503
    data = response.get_json()
    assert data['qdrant'] == 'down'
