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
            self.model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5", threads=1)
            self._ensure_collection()

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
                    payload={"uuid": post_uuid}    
                )
            ],
        )
        return True

    def search_similar_post(self, query_text, limit=10):
        """Retrieves Top-K results using similarity scores."""
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
                "score": round(hit.score, 4)
            }
            for hit in search_result.points
        ]

# =================== HEAVEY BOOT CODE FOR DEPLOYMENT ON POWERED SERVER: CPU AND MEMORY ===================

# import os
# from qdrant_client import QdrantClient
# from qdrant_client.models import Distance, VectorParams, PointStruct 
# from fastembed import TextEmbedding # Import this directly
# from dotenv import load_dotenv

# load_dotenv()

# class EmbeddingService:
#     def __init__(self):
#         # Initialize the Qdrant client cloud
#         self.client = QdrantClient(
#             url = os.getenv("QDRANT_URL"),
#             api_key = os.getenv("QDRANT_API_KEY"),
#             timeout=60
#         )
#         self.collection_name = os.getenv("QDRANT_COLLECTION_NAME")

#         # We tell the client to use FastEmbed for local vectorization
#         # This uses the 'BAAI/bge-small-en-v1.5' model by default (~100MB)
#         self.model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
#         self._ensure_collection()


#     def _ensure_collection(self):
#         """Create the collection in Qdrant cloud if not exists."""
#         collections = self.client.get_collections().collections
#         exists = any(c.name == self.collection_name for c in collections)

#         if not exists:
#             # 384 is the size for bge-small-en or all-MiniLM-L6-v2
#             self.client.create_collection(
#                 collection_name=self.collection_name,
#                 vectors_config=VectorParams(size=384, distance=Distance.COSINE),
#             )

#     def _get_embedding(self, text):
#         """Internal helper to vectorize text. Centralizes math logic."""
#         embeddings = list(self.model.embed([text]))
#         return embeddings[0].tolist()

    
#     def store_post(self, post_uuid, title, description):
#         # concatenate title and description for richer semantic context
#         combined_text = f"{title}. {description}"
#         print(f"Embedding post: {post_uuid}")  #this logg correctly 
#         # FastEmbed generate the vector in one line
#         # we use list (because the embedder returns a generator)
#         embeddings = list(self.model.embed([combined_text])) 
#         # vector = embeddings[0].tolist()
#         vector = self._get_embedding(combined_text)
       
#         # upsert the post into qdrant
#         self.client.upsert(
#             collection_name=self.collection_name,
#             points=[
#                 PointStruct(
#                     id=post_uuid, 
#                     vector=vector,
#                     payload={"uuid": post_uuid}    
#                 )
#             ],
#         )

#         return True

    
#     def search_similar_post(self, query_text, limit=10):
#         """
#         Retrieves Top-K results. 
#         Returns a list of dicts with postuuid and similarity score.
#         """
#         query_vector = self._get_embedding(query_text)

#         search_result = self.client.query_points(
#             collection_name=self.collection_name,
#             query=query_vector,
#             limit=limit,
#             with_payload=True
#         )
#         return [
#             {
#                 "uuid": hit.payload.get("uuid"),
#                 "score": round(hit.score, 4)
#             }
#             for hit in search_result.points
#         ]
