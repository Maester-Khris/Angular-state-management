import pytest
from unittest.mock import patch, MagicMock

from services.search_providers.exa_contents_client import ExaContentsClient

SAMPLE_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "source_name": {"type": "string"},
        "source_small_headline": {"type": "string"},
        "source_small_description": {"type": "string"},
    },
    "required": ["source_name", "source_small_headline", "source_small_description"],
}


def make_response(json_body: dict, status: int = 200):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = json_body
    resp.raise_for_status = MagicMock()
    if status >= 400:
        resp.raise_for_status.side_effect = Exception(f"HTTP {status}")
    return resp


def test_get_summaries_sends_urls_query_and_schema(monkeypatch):
    monkeypatch.setenv("EXA_API_KEY", "test-key")
    client = ExaContentsClient()

    with patch("services.search_providers.exa_contents_client.requests.post") as mock_post:
        mock_post.return_value = make_response({
            "results": [{
                "id": "https://redis.io/patterns",
                "url": "https://redis.io/patterns",
                "title": "Coding patterns",
                "favicon": "https://redis.io/favicon.png",
                "summary": '{"source_name": "Redis Docs", "source_small_headline": "Patterns", "source_small_description": "Covers cache-aside and more."}',
            }]
        })
        results = client.get_summaries(["https://redis.io/patterns"], "redis caching", SAMPLE_SCHEMA)

    call_kwargs = mock_post.call_args.kwargs
    assert call_kwargs["headers"]["x-api-key"] == "test-key"
    assert call_kwargs["json"]["urls"] == ["https://redis.io/patterns"]
    assert call_kwargs["json"]["summary"]["query"] == "redis caching"
    assert call_kwargs["json"]["summary"]["schema"] == SAMPLE_SCHEMA

    assert len(results) == 1
    assert results[0]["summary"] == {
        "source_name": "Redis Docs",
        "source_small_headline": "Patterns",
        "source_small_description": "Covers cache-aside and more.",
    }
    assert results[0]["favicon"] == "https://redis.io/favicon.png"


def test_get_summaries_raises_on_http_error(monkeypatch):
    monkeypatch.setenv("EXA_API_KEY", "test-key")
    client = ExaContentsClient()

    with patch("services.search_providers.exa_contents_client.requests.post") as mock_post:
        mock_post.return_value = make_response({}, status=500)
        with pytest.raises(Exception):
            client.get_summaries(["https://x.com"], "q", SAMPLE_SCHEMA)


def test_missing_api_key_raises_at_construction(monkeypatch):
    monkeypatch.delenv("EXA_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        ExaContentsClient()
