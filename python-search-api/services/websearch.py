import os
import asyncio
import serpapi
from urllib.parse import urlparse

class WebSearchService:
    def __init__(self):
        self.api_key = os.getenv("SERPAPI_API_KEY")
        if not self.api_key:
            raise RuntimeError("SERPAPI_API_KEY environment variable is not set")
        self.client = serpapi.Client(api_key=self.api_key) 

    def _build_favicon(self, url: str) -> str:
        try:
            domain = urlparse(url).netloc
            return f"https://www.google.com/s2/favicons?domain={domain}&sz=64"
        except Exception:
            return ""

    def _search_sync(self, query: str, limit: int) -> list[dict]:
        """Blocking SerpApi call — run in executor to avoid blocking the event loop."""
        params = {
            "engine": "google",
            "q": query,
            "num": limit,
            "google_domain": "google.com",
            "gl": "us",
            "hl": "en",
        }

        results = self.client.search(params)

        if "error" in results:
            raise RuntimeError(f"SerpApi error: {results['error']}")

        return [
            {
                "title": item.get("title"),
                "url": item.get("link"),
                "description": item.get("snippet"),
                "favicon": self._build_favicon(item.get("link", "")),
            }
            for item in results.get("organic_results", [])[:limit]
        ]

    async def search(self, query: str, limit: int = 5) -> list[dict]:
        """Async wrapper — offloads blocking SDK call to a thread."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._search_sync, query, limit
        )


# web_search_service.py
# import os
# import httpx
# # print(os.getenv("GOOGLE_SEARCH_API_KEY"))
# class WebSearchService:
#     def __init__(self):
#         self.api_key = os.getenv("GOOGLE_SEARCH_API_KEY")  # serper.dev — cheapest Google Search API
#         self.endpoint = "https://google.serper.dev/search"

#     async def search(self, query: str, limit: int = 5) -> list[dict]:
#         headers = {"X-API-KEY": self.api_key, "Content-Type": "application/json"}
#         payload = {"q": query, "num": limit}

#         async with httpx.AsyncClient() as client:
#             response = await client.post(self.endpoint, json=payload, headers=headers)
#             response.raise_for_status()
#             data = response.json()

#         return [
#             {
#                 "title": item.get("title"),
#                 "url": item.get("link"),
#                 "description": item.get("snippet"),
#                 "favicon": f"https://www.google.com/s2/favicons?domain={item.get('link')}"
#             }
#             for item in data.get("organic", [])[:limit]
#         ]