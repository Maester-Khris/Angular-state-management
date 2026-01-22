import os
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct 
from fastembed import TextEmbedding # Import this directly
from dotenv import load_dotenv

load_dotenv()

class SearchService:
    def __init__(self):
        # Initialize the Qdrant client cloud
        self.client = QdrantClient(
            url = os.getenv("QDRANT_URL"),
            api_key = os.getenv("QDRANT_API_KEY")
        )
        self.collection_name = os.getenv("QDRANT_COLLECTION_NAME")

        # We tell the client to use FastEmbed for local vectorization
        # This uses the 'BAAI/bge-small-en-v1.5' model by default (~100MB)
        self.model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        self._ensure_collection()


    def _ensure_collection(self):
        """Create the collection in Qdrant cloud if not exists."""
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)

        if not exists:
            # 384 is the size for bge-small-en or all-MiniLM-L6-v2
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=384, distance=Distance.COSINE),
            )

    
    def store_post(self, post_uuid, title, description):
        # concatenate title and description for richer semantic context
        combined_text = f"{title}. {description}"
        print(f"Embedding post: {post_uuid}")  #this logg correctly 
        # FastEmbed generate the vector in one line
        # we use list (because the embedder returns a generator)
        embeddings = list(self.model.embed([combined_text])) 
        vector = embeddings[0].tolist()
       
        # upsert the post into qdrant
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=post_uuid, 
                    vector=vector,
                    payload={"postuuid": post_uuid}    
                )
            ],
        )

        return True
