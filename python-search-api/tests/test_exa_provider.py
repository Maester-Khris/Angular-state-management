import pytest
from unittest.mock import AsyncMock, MagicMock

from services.search_providers.exa_provider import ExaWebSearchAdapter
from services.search_providers.base import WebResult

SAMPLE_EXA_TEXT = (
    "Title: Redis Caching Patterns for Web Applications | ECOSIRE\n"
    "URL: https://ecosire.com/blog/redis-caching-patterns-guide\n"
    "Published: N/A\n"
    "Author: N/A\n"
    "Highlights:\n"
    "Master Redis caching patterns for Node.js: cache-aside, write-through.\n"
    "\n---\n\n"
    "Title: Caching patterns - Database Caching Strategies Using Redis\n"
    "URL: https://docs.aws.amazon.com/whitepapers/caching-patterns.html\n"
    "Published: N/A\n"
    "Author: N/A\n"
    "Highlights:\n"
    "When caching data from your database, there are patterns for Redis.\n"
)


def make_call_tool_result(text: str):
    block = MagicMock()
    block.text = text
    result = MagicMock()
    result.content = [block]
    return result


@pytest.mark.asyncio
async def test_search_maps_exa_text_response_to_web_results():
    adapter = ExaWebSearchAdapter.__new__(ExaWebSearchAdapter)
    adapter._client = AsyncMock()
    adapter._consecutive_failures = 0
    adapter._client.call_tool.return_value = make_call_tool_result(SAMPLE_EXA_TEXT)

    results = await adapter.search("redis caching", limit=2)

    assert len(results) == 2
    assert results[0] == WebResult(
        title="Redis Caching Patterns for Web Applications | ECOSIRE",
        url="https://ecosire.com/blog/redis-caching-patterns-guide",
        favicon="https://www.google.com/s2/favicons?domain=ecosire.com&sz=64",
        snippet="Master Redis caching patterns for Node.js: cache-aside, write-through.",
    )
    assert results[1].title == "Caching patterns - Database Caching Strategies Using Redis"

@pytest.mark.asyncio
async def test_search_returns_empty_list_when_no_content():
    adapter = ExaWebSearchAdapter.__new__(ExaWebSearchAdapter)
    adapter._client = AsyncMock()
    adapter._consecutive_failures = 0
    empty_result = MagicMock()
    empty_result.content = []
    adapter._client.call_tool.return_value = empty_result

    results = await adapter.search("obscure query", limit=5)
    assert results == []

@pytest.mark.asyncio
async def test_search_never_raises_returns_empty_on_failure():
    adapter = ExaWebSearchAdapter.__new__(ExaWebSearchAdapter)
    adapter._client = AsyncMock()
    adapter._consecutive_failures = 0
    adapter._client.call_tool.side_effect = Exception("MCP timeout")

    results = await adapter.search("redis caching", limit=5)
    assert results == []

@pytest.mark.asyncio
async def test_circuit_breaker_short_circuits_after_threshold():
    adapter = ExaWebSearchAdapter.__new__(ExaWebSearchAdapter)
    adapter._client = AsyncMock()
    adapter._consecutive_failures = 0
    adapter._client.call_tool.side_effect = Exception("MCP down")

    for _ in range(ExaWebSearchAdapter.CIRCUIT_BREAKER_THRESHOLD):
        await adapter.search("q", limit=5)

    call_count_before = adapter._client.call_tool.call_count
    await adapter.search("q", limit=5)  # should short-circuit, not call the client again
    assert adapter._client.call_tool.call_count == call_count_before
