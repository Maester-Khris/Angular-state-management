from unittest.mock import MagicMock

from services.search_providers.exa_summary_provider import ExaSourceSummaryAdapter


def make_adapter_with_client(mock_get_summaries):
    adapter = ExaSourceSummaryAdapter.__new__(ExaSourceSummaryAdapter)
    adapter._client = MagicMock()
    adapter._client.get_summaries = mock_get_summaries
    return adapter


def test_summarize_maps_response_to_source_shape():
    def fake_get_summaries(urls, query, schema):
        return [{
            "url": "https://redis.io/patterns",
            "favicon": "https://redis.io/favicon.png",
            "summary": {
                "source_name": "Redis Docs",
                "source_small_headline": "Patterns",
                "source_small_description": "Covers cache-aside and more.",
            },
        }]

    adapter = make_adapter_with_client(fake_get_summaries)
    web_results = [{"title": "Redis Docs (raw)", "url": "https://redis.io/patterns", "favicon": "", "description": "official docs"}]

    results = adapter.summarize("redis caching strategies", web_results)

    assert results == [{
        "source_name": "Redis Docs",
        "source_url": "https://redis.io/patterns",
        "source_small_headline": "Patterns",
        "source_small_description": "Covers cache-aside and more.",
        "favicon": "https://redis.io/favicon.png",
    }]


def test_summarize_returns_empty_list_on_empty_input():
    adapter = make_adapter_with_client(MagicMock())
    assert adapter.summarize("query", []) == []
    adapter._client.get_summaries.assert_not_called()


def test_summarize_never_raises_returns_empty_on_failure():
    def raising_get_summaries(urls, query, schema):
        raise Exception("HTTP 500")

    adapter = make_adapter_with_client(raising_get_summaries)
    web_results = [{"title": "X", "url": "https://x.com", "favicon": "", "description": "d"}]
    assert adapter.summarize("query", web_results) == []


def test_summarize_falls_back_to_original_favicon_when_exa_omits_it():
    def fake_get_summaries(urls, query, schema):
        return [{
            "url": "https://x.com",
            "favicon": "",
            "summary": {"source_name": "X", "source_small_headline": "H", "source_small_description": "D"},
        }]

    adapter = make_adapter_with_client(fake_get_summaries)
    web_results = [{"title": "X", "url": "https://x.com", "favicon": "https://x.com/original.ico", "description": "d"}]
    results = adapter.summarize("query", web_results)
    assert results[0]["favicon"] == "https://x.com/original.ico"


def test_summarize_caps_at_5_sources():
    seen = {}
    def fake_get_summaries(urls, query, schema):
        seen["urls"] = urls
        return [{"url": u, "favicon": "", "summary": {"source_name": "n", "source_small_headline": "h", "source_small_description": "d"}} for u in urls]

    adapter = make_adapter_with_client(fake_get_summaries)
    web_results = [{"title": f"Doc {i}", "url": f"https://x.com/{i}", "favicon": "", "description": "d"} for i in range(8)]
    adapter.summarize("query", web_results)
    assert len(seen["urls"]) == 5
