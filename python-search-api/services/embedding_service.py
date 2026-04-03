import os
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct 
from fastembed import TextEmbedding 
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        # We only set the configuration strings on init.
        # No heavy objects are created here to ensure near-instant app startup.
        self.qdrant_url = os.getenv("QDRANT_URL")
        self.qdrant_api_key = os.getenv("QDRANT_API_KEY")
        self.collection_name = os.getenv("QDRANT_COLLECTION_NAME")
        self.cache_dir = os.getenv("PYTHON_FASTEMBED_CACHE_DIR")
        
        # Placeholders for lazy-loaded resources
        self.client = None
        self.model = None

    def _initialize_resources(self):
        """
        Internal gateway. Only runs once when the first request hits.
        This moves the 'Download and Load' delay away from deployment boot.
        """
        if self.client is None:
            print("Lazy Loading: Connecting to Qdrant Cloud...")
            self.client = QdrantClient(
                url=self.qdrant_url,
                api_key=self.qdrant_api_key,
                timeout=60
            )

        if self.model is None:
            print("Lazy Loading: Initializing FastEmbed model (BAAI/bge-small-en-v1.5)...")
            # threads=1 is critical for Render's Free Tier to prevent OOM/CPU spikes
            # self.model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5", threads=1)
            self.model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5", threads=1, cache_dir=self.cache_dir)
            self._ensure_collection()
            list(self.model.embed(['warmup']))  # triggers download/load, result discarded

    def _ensure_collection(self):
        """Create the collection in Qdrant cloud if not exists."""
        # Note: self.client is guaranteed to exist by _initialize_resources call
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)

        if not exists:
            print(f"Creating collection: {self.collection_name}")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )

    def _get_embedding(self, text):
        """Internal helper to vectorize text. Triggers lazy initialization."""
        self._initialize_resources()
        embeddings = list(self.model.embed([text]))
        return embeddings[0].tolist()

    def store_post(self, post_uuid, title, description):
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
                    payload={"uuid": post_uuid, "title": title, "description": description}    
                )
            ],
        )
        return True

    def search_similar_post(self, query_text, limit=10):
        """Retrieves Top-K results using similarity scores."""
        # Guard: return empty list instead of None if not ready
        if self.model is None or self.client is None:
            return []

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

