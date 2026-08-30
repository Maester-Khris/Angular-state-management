import os

from fastmcp import Client

EXA_MCP_URL = "https://mcp.exa.ai/mcp"
EXA_SEARCH_TOOL = "web_search_exa"


class ExaMcpClient:
    """Owns the FastMCP session lifecycle only — no business logic, no response
    mapping. Long-lived client per the design doc §5, matching the existing
    local convention (serpapi.Client/Groq clients instantiated once in __init__)."""

    def __init__(self):
        api_key = os.getenv("EXA_API_KEY")
        if not api_key:
            raise RuntimeError("EXA_API_KEY environment variable is not set")
        self._client = Client(EXA_MCP_URL, auth=api_key)

    async def call_tool(self, name: str, arguments: dict):
        async with self._client:
            result = await self._client.call_tool(name, arguments)
            return result
