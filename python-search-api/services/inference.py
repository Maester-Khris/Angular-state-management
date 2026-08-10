import os
import json
import re
from groq import AsyncGroq

_PUNCTUATION_RE = re.compile(r"[.,;:!?\"']")
MAX_EXPANSION_KEYWORDS = 8
MAX_EXPANSION_TOKENS = 32  # generous ceiling for 8 keywords at Groq's tokenizer rate


def _enforce_expansion_format(raw: str, max_keywords: int = MAX_EXPANSION_KEYWORDS) -> str:
    """Code-level contract for expand_query's output — the prompt asks nicely,
    this makes it true. Strips punctuation, truncates to max_keywords tokens."""
    cleaned = _PUNCTUATION_RE.sub("", raw).strip()
    tokens = cleaned.split()
    return " ".join(tokens[:max_keywords])


class InferenceService:
    def __init__(self):
        self.client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("PYTHON_LLM_MODEL", "llama-3.3-70b-versatile")

    async def check_readiness(self):
        """Probes the AI provider for a minimal response to confirm API key/quota."""
        try:
            # Simple metadata check or low-token completion
            await self.client.models.retrieve(self.model)
            return True
        except Exception as e:
            print(f"Groq Readiness Error: {e}")
            return False


    async def expand_query(self, query: str, context_docs: list[dict]) -> str:
        """
        Detects user intent and dominant topic from Qdrant snippets to produce a refined web search query.
        Constraints: Strictly tech/engineering domain, 5-8 space-separated keywords, enforced in code
        (not just the prompt) via _enforce_expansion_format.
        """
        similar_docs_text = "\n".join(
            f"- {doc.get('title', '')}: {doc.get('description', '')[:100]}"
            for doc in (context_docs or [])
        ) or "No similar documents found."

        system_prompt = """You are a search query expansion assistant for a software engineering and technology platform.

Your only job is to expand a user's search query into a short list of related technical keywords that will improve search recall.

STRICT RULES:
- Output ONLY a space-separated list of keywords. No sentences, no punctuation, no explanation.
- Every keyword must be directly relevant to software engineering, computer science, or technology.
- If the query is ambiguous (e.g. "life", "intelligence", "memory"), interpret it in its SOFTWARE/ENGINEERING context:
    "life"        → software lifecycle, service uptime, TTL, reliability
    "intelligence" → artificial intelligence, ML systems, intelligent agents
    "memory"      → memory management, heap, garbage collection, caching
- NEVER expand into: biology, philosophy, geography, history, lifestyle, wellness, or any non-technical domain.
- Use the provided similar documents as additional context clues for the technical intent.
- Output 5-8 keywords maximum.

FULL EXAMPLES (query -> correct expansion, exactly this format):
Query: "how do I make my api faster"
Output: api latency optimization caching database indexing profiling

Query: "react app crashing randomly"
Output: react error boundary state management debugging stack trace

Query: "kubernetes deployment issues"
Output: kubernetes deployment rollback health checks pod scheduling
"""

        user_prompt = f"""Query: "{query}"

Similar documents from our platform (use for context):
{similar_docs_text}

Expand this query into 5-8 technical keywords relevant to software engineering."""

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0,
            max_tokens=MAX_EXPANSION_TOKENS,
        )

        raw = response.choices[0].message.content.strip().strip('"')
        expanded = _enforce_expansion_format(raw)

        # Guard: if enforcement collapsed it to nothing (or the LLM returned garbage), fall back
        if not expanded or len(expanded) < 3:
            return query

        return expanded


    async def generate_relevant_sources(self, query: str, web_results: list[dict]) -> list[dict]:
        """
        Filters and reranks web results from SerpAPI for relevance.
        """
        if not web_results:
            return []

        formatted_results = "\n\n".join(
            f"Index: {i}\n"
            f"Title: {res.get('title')}\n"
            f"Desc: {res.get('description')}\n"
            f"URL: {res.get('url')}"
            for i, res in enumerate(web_results)
        )

        prompt = f"""You are a research assistant filtering web search results.
        Original Goal: {query}
        
        Web Results:
        {formatted_results}

        Task: Select the top 3-5 most relevant sources from the provided list. 
        Return them as a JSON array of objects with this EXACT schema:
        {{
            "source_name": "Site name or short title",
            "source_url": "Full URL",
            "source_small_headline": "Compelling headline from the result",
            "source_small_description": "Brief 1-sentence summary of why this is relevant",
            "favicon": "Use the favicon URL provided in the input if available, or stay empty"
        }}

        Rules:
        1. Only include high-quality, relevant results.
        2. Match the "favicon" field by looking up the corresponding index in the input data.
        3. Return ONLY valid JSON. No markdown fences.
        """

        # Map back favicons after LLM returns indices or just rely on URL matching if needed.
        # However, to be safer, we can pass favicons in the prompt or just re-map them by URL in post-processing.
        # Let's pass the favicons in the prompt to make it easier for the LLM to include them.
        
        # Revised prompt formatting to include index and favicon
        formatted_results_with_metadata = []
        for i, res in enumerate(web_results):
            formatted_results_with_metadata.append(
                f"Index: {i}\n"
                f"Title: {res.get('title')}\n"
                f"URL: {res.get('url')}\n"
                f"Favicon: {res.get('favicon')}\n"
                f"Snippet: {res.get('description')}"
            )
        
        results_block = "\n\n".join(formatted_results_with_metadata)
        prompt = f"""You are a research assistant filtering web search results.
        Goal: {query}

        Web Results:
        {results_block}

        Return a JSON array of the most relevant results (max 5).
        Schema:
        {{
            "source_name": "string",
            "source_url": "string",
            "source_small_headline": "string",
            "source_small_description": "string",
            "favicon": "string"
        }}
        Return ONLY valid JSON.
        """

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a precise JSON extractor. Return only a JSON array."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Fallback or cleanup if LLM fails
            return []
