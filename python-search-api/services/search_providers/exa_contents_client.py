import json
import os

import requests

EXA_CONTENTS_URL = "https://api.exa.ai/contents"


class ExaContentsClient:
    """Owns the REST session/auth only — no business logic, no schema decisions. Same role as
    exa_mcp_client.py's ExaMcpClient, but for the REST surface: this codebase's MCP integration
    (exa_mcp_client.py) only exposes web_search_exa/web_fetch_exa — confirmed live 2026-08-19
    (docs/superpowers/plans/2026-08-19-exa-summary-vs-reranking-spike.md, Task 1) — the
    schema-guided summary capability this client wraps only exists on Exa's REST API, not MCP.
    A second Exa integration, deliberately: the capability isn't reachable any other way."""

    def __init__(self):
        api_key = os.getenv("EXA_API_KEY")
        if not api_key:
            raise RuntimeError("EXA_API_KEY environment variable is not set")
        self._api_key = api_key

    def get_summaries(self, urls: list[str], query: str, schema: dict) -> list[dict]:
        """Raises on any transport/HTTP failure — the caller (ExaSourceSummaryAdapter) is
        responsible for the never-raises contract at the pipeline boundary, matching this
        codebase's existing client-can-raise/adapter-never-raises split."""
        response = requests.post(
            EXA_CONTENTS_URL,
            headers={"x-api-key": self._api_key, "Content-Type": "application/json"},
            json={"urls": urls, "summary": {"query": query, "schema": schema}},
            timeout=30,
        )
        response.raise_for_status()
        body = response.json()

        results = []
        for item in body.get("results", []):
            entry = dict(item)
            raw_summary = entry.get("summary")
            if isinstance(raw_summary, str):
                try:
                    entry["summary"] = json.loads(raw_summary)
                except (ValueError, TypeError):
                    entry["summary"] = {}
            results.append(entry)
        return results
