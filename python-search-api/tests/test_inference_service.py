import os
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")

import pytest
from unittest.mock import AsyncMock, MagicMock

from services.inference import InferenceService


def make_groq_response(content: str):
    message = MagicMock()
    message.content = content
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


@pytest.mark.asyncio
async def test_expand_query_truncates_over_limit_output():
    svc = InferenceService()
    svc.client.chat.completions.create = AsyncMock(
        return_value=make_groq_response("one two three four five six seven eight nine ten")
    )
    result = await svc.expand_query("test query")
    assert len(result.split()) <= 8

@pytest.mark.asyncio
async def test_expand_query_strips_punctuation():
    svc = InferenceService()
    svc.client.chat.completions.create = AsyncMock(
        return_value=make_groq_response("caching, redis, and TTL invalidation.")
    )
    result = await svc.expand_query("test query")
    assert "," not in result and "." not in result

@pytest.mark.asyncio
async def test_expand_query_falls_back_to_original_on_empty():
    svc = InferenceService()
    svc.client.chat.completions.create = AsyncMock(return_value=make_groq_response(""))
    result = await svc.expand_query("original query")
    assert result == "original query"

@pytest.mark.asyncio
async def test_expand_query_passes_max_tokens():
    svc = InferenceService()
    mock_create = AsyncMock(return_value=make_groq_response("redis caching ttl"))
    svc.client.chat.completions.create = mock_create
    await svc.expand_query("test query")
    _, kwargs = mock_create.call_args
    assert kwargs.get("max_tokens") is not None and kwargs["max_tokens"] <= 32
