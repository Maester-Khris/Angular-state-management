import asyncio
import os
from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from dotenv import load_dotenv

load_dotenv()

VECTOR_SIZE = 384  # BAAI/bge-small-en-v1.5 output dimension — update if EMBEDDING_MODEL changes


class EmbeddingService:
    def __init__(self):
        self.qdrant_url = os.getenv("QDRANT_URL")
        self.qdrant_api_key = os.getenv("QDRANT_API_KEY")
        self.collection_name = os.getenv("QDRANT_COLLECTION_NAME")
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
        self.cache_dir = os.getenv("PYTHON_FASTEMBED_CACHE_DIR")

        # Placeholders for lazy-loaded resources
        self.client = None
        self.model = None

    def _initialize_resources(self):
        """
        Internal gateway. Only runs once when the first request hits.
        Moves initialization delay away from deployment boot.
        """
        if self.client is None:
            print("Lazy Loading: Connecting to Qdrant Cloud...")
            self.client = QdrantClient(
                url=self.qdrant_url,
                api_key=self.qdrant_api_key,
                timeout=60,
                check_compatibility=False,
            )
            self._ensure_collection()

        if self.model is None:
            print(f"Lazy Loading: Initializing FastEmbed model ({self.embedding_model})...")
            # threads=1 is critical for Render's Free Tier to prevent OOM/CPU spikes
            self.model = TextEmbedding(model_name=self.embedding_model, threads=1, cache_dir=self.cache_dir)
            list(self.model.embed(['warmup']))  # triggers download/load, result discarded

    def _ensure_collection(self):
        """Create the Qdrant collection if it does not exist."""
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)

        if not exists:
            print(f"Creating collection: {self.collection_name}")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )

    def _get_embedding(self, text: str) -> list[float]:
        """Vectorize text via the local FastEmbed model. Triggers lazy initialization."""
        self._initialize_resources()
        embeddings = list(self.model.embed([text]))
        return embeddings[0].tolist()

    def ping(self) -> bool:
        """Real round trip to Qdrant — used by the keepalive endpoint, not the search path."""
        self._initialize_resources()
        self.client.get_collections()
        return True

    def store_post(self, post_uuid: str, title: str, description: str) -> bool:
        """Upserts a post into Qdrant after semantic vectorization."""
        combined_text = f"{title}. {description}"
        print(f"Embedding and storing post: {post_uuid}")

        vector = self._get_embedding(combined_text)

        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=post_uuid,
                    vector=vector,
                    payload={
                        "uuid": post_uuid,
                        "title": title,
                        "description": description
                    }
                )
            ],
        )
        return True

    def search_similar_post(self, query_text: str, limit: int = 10) -> list:
        """Retrieves Top-K results using cosine similarity."""
        # _get_embedding() calls _initialize_resources() itself (idempotent lazy-init) —
        # no separate readiness guard needed. The old guard checked client/model before
        # ever giving _get_embedding a chance to set them, so it could never self-initialize
        # and silently returned [] forever instead of surfacing a real failure.
        query_vector = self._get_embedding(query_text)

        search_result = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=limit,
            with_payload=True
        )

        return [
            {
                "uuid": hit.payload.get("uuid"),
                "title": hit.payload.get("title"),
                "description": hit.payload.get("description"),
                "score": round(hit.score, 4)
            }
            for hit in search_result.points
        ]

    async def search_similar_post_async(self, query_text: str, limit: int = 10) -> list:
        """Async wrapper — offloads the blocking Qdrant/embedding call to a thread,
        matching the pattern WebSearchService already uses for its blocking SDK call."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.search_similar_post, query_text, limit)
