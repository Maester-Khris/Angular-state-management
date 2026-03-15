import pytest

def test_embed_success(client, auth_headers, mock_embedding_svc):
    """Valid payload -> 201, body contains 'status': 'success' and 'uuid'"""
    payload = {
        "postuuid": "test-uuid-123",
        "title": "Test Title",
        "description": "Test Description"
    }
    response = client.post('/embed', json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.get_json()
    assert data['status'] == 'success'
    assert data['uuid'] == "test-uuid-123"
    
    # Verify mock call
    mock_embedding_svc.store_post.assert_called_once_with("test-uuid-123", "Test Title", "Test Description")

def test_embed_missing_uuid(client, auth_headers):
    """Payload without postuuid -> 400"""
    payload = {"title": "No UUID"}
    response = client.post('/embed', json=payload, headers=auth_headers)
    assert response.status_code == 400
    assert "error" in response.get_json()

def test_embed_no_auth(client):
    """Valid payload, no X-Internal-Key header -> 401"""
    payload = {"postuuid": "123", "title": "T", "description": "D"}
    response = client.post('/embed', json=payload)
    assert response.status_code == 401
    assert response.get_json()['error'] == "Unauthorized"

def test_embed_wrong_key(client):
    """Valid payload, wrong key -> 401"""
    payload = {"postuuid": "123", "title": "T", "description": "D"}
    response = client.post('/embed', json=payload, headers={"X-Internal-Key": "wrong-key"})
    assert response.status_code == 401
