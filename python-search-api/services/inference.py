import os
import json
from groq import AsyncGroq

class InferenceService:
    def __init__(self):
        self.client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

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
        """
        formatted_context = "\n".join(
            f"- {doc.get('title', 'Untitled')}: {doc.get('description', '')[:100]}..."
            for doc in context_docs
        )

        prompt = f"""You are an expert search engineer.
        Original Query: {query}
        Local Context (to help detect intent/topic):
        {formatted_context}

        Task: Synthesize a single, highly effective Google Search query that would find relevant external sources matching the user's intent.
        The expanded query should be specific and professional.
        Return ONLY the plain-text search string. No quotes, no explanation, no markdown.
        """

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Return only the raw search query string."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
        )

        return response.choices[0].message.content.strip().strip('"')


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
        
        prompt = f"""You are a research assistant filtering web search results.
        Goal: {query}
        
        Web Results:
        {"\n\n".join(formatted_results_with_metadata)}

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
