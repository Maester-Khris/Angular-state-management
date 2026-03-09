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


    async def generate_relevant_sources(self, query:str, context:list[dict])->list[dict]:

        formatted_context = "\n\n".join(
            f"Title: {doc.get('title', 'Untitled')}\n"
            f"Description: {doc.get('description', '')}"
            for doc in context
        )

        prompt = f"""You are given a user question and a list of document presenting a post on a specif topic.
        Your task is to identify web sources that are most relevant to the question and the common topic of provided posts and return them as a JSON array.
        Each item in the array of returned web sources must follow this exact schema:
        {{
            "source_name": "...",
            "source_url": "...",
            "source_small_headline": "...",
            "source_small_description": "..."
        }}
        Only include sources that genuinely help answer the question.
        Do not invent or infer any fields — use only what is provided.
        Return only a valid JSON array — no explanation, no markdown.
        Question: {query}
        Retrieved Sources: {formatted_context}
        """

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise assistant that returns only valid JSON arrays, no markdown or commentary."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            temperature=0.0,  # deterministic output for structured extraction
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if the model wraps output anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        return json.loads(raw)
