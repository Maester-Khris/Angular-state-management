from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class WebResult:
    """Value Object (DDD sense) — immutable, no identity. The app's own
    vocabulary for an external web-search hit, independent of any vendor's
    response shape."""
    title: str
    url: str
    favicon: str
    snippet: str


class WebSearchProvider(ABC):
    """Port — nothing vendor-specific here. app.py depends on this, not on Exa."""

    @abstractmethod
    async def search(self, query: str, limit: int) -> list[WebResult]:
        ...
