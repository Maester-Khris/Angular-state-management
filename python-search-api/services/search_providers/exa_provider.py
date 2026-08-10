import re
from urllib.parse import urlparse

from services.search_providers.base import WebResult, WebSearchProvider
from services.search_providers.exa_mcp_client import EXA_SEARCH_TOOL, ExaMcpClient

# web_search_exa returns one text block with entries separated by "\n---\n\n",
# each formatted as "Title: ...\nURL: ...\nPublished: ...\nAuthor: ...\nHighlights:\n<text>"
# — confirmed against the live MCP server (no structured JSON, no favicon field).
_ENTRY_RE = re.compile(
    r"Title:\s*(?P<title>.*?)\nURL:\s*(?P<url>.*?)\nPublished:.*?\nAuthor:.*?\nHighlights:\s*\n?(?P<highlights>.*)",
    re.DOTALL,
)


class ExaWebSearchAdapter(WebSearchProvider):
    """Vendor name appears exactly once — here, at the edge. app.py only ever
    sees WebResult, possibly empty. Never raises past this boundary."""

    CIRCUIT_BREAKER_THRESHOLD = 5

    def __init__(self):
        self._client = ExaMcpClient()
        self._consecutive_failures = 0

    def _build_favicon(self, url: str) -> str:
        try:
            domain = urlparse(url).netloc
            return f"https://www.google.com/s2/favicons?domain={domain}&sz=64"
        except Exception:
            return ""

    def _map_response(self, raw_text: str) -> list[WebResult]:
        if not raw_text or not raw_text.strip():
            return []

        results = []
        for entry in raw_text.split("\n---\n\n"):
            match = _ENTRY_RE.match(entry.strip())
            if not match:
                continue
            url = match.group("url").strip()
            results.append(
                WebResult(
                    title=match.group("title").strip(),
                    url=url,
                    favicon=self._build_favicon(url),
                    snippet=match.group("highlights").strip(),
                )
            )
        return results

    async def search(self, query: str, limit: int) -> list[WebResult]:
        if self._consecutive_failures >= self.CIRCUIT_BREAKER_THRESHOLD:
            return []

        try:
            raw = await self._client.call_tool(EXA_SEARCH_TOOL, {"query": query, "numResults": limit})
            self._consecutive_failures = 0
            if not raw.content:
                return []
            return self._map_response(raw.content[0].text)
        except Exception:
            self._consecutive_failures += 1
            return []
