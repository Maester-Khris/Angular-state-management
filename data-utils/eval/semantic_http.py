# data-utils/eval/semantic_http.py
# Thin HTTP wrapper around python-search-api's plain POST /search endpoint -- the Qdrant-only
# leg node-backend/services/remotesearch.js's getSemanticMatches calls. NOT /search/ai (that
# pipeline is evaluated separately, via data-utils/eval/run_harness.py).

import requests


def search_semantic(base_url: str, internal_key: str, query: str, limit: int = 10) -> list[dict]:
    resp = requests.post(
        f"{base_url}/search",
        json={"query": query, "limit": limit},
        headers={"X-Internal-Key": internal_key},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("results", [])
