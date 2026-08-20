from services.search_providers.exa_contents_client import ExaContentsClient

MAX_SOURCES = 5

SOURCE_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "source_name": {"type": "string"},
        "source_small_headline": {"type": "string"},
        "source_small_description": {"type": "string"},
    },
    "required": ["source_name", "source_small_headline", "source_small_description"],
}


class ExaSourceSummaryAdapter:
    """Spike: built to be measured against generate_relevant_sources (Task 5's comparison), not
    assumed to replace it. Never raises past this boundary, matching every other provider's
    contract at this pipeline edge (see ExaWebSearchAdapter.search)."""

    def __init__(self):
        self._client = ExaContentsClient()

    def summarize(self, query: str, web_results: list[dict]) -> list[dict]:
        if not web_results:
            return []

        sources = web_results[:MAX_SOURCES]
        by_url = {r["url"]: r for r in sources}
        urls = list(by_url.keys())

        try:
            raw_results = self._client.get_summaries(urls, query, SOURCE_SCHEMA)
        except Exception:
            return []

        results = []
        for item in raw_results:
            original = by_url.get(item.get("url", ""), {})
            summary = item.get("summary") or {}
            results.append({
                "source_name": summary.get("source_name", original.get("title", "")),
                "source_url": item.get("url", original.get("url", "")),
                "source_small_headline": summary.get("source_small_headline", ""),
                "source_small_description": summary.get("source_small_description", ""),
                "favicon": item.get("favicon") or original.get("favicon", ""),
            })
        return results
