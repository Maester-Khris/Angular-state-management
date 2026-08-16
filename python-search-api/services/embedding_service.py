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

    def search_similar_post(
        self,
        query_text: str,
        limit: int = 10,
        score_threshold: float | None = None,
    ) -> list:
        """Retrieves Top-K results using cosine similarity.

        Args:
            query_text:      The search query string.
            limit:           Maximum number of results to return.
            score_threshold: Optional minimum cosine similarity. Results scoring
                             below this value are excluded server-side by Qdrant.
                             Must be calibrated empirically per the BAAI bge-small-en-v1.5
                             model card guidance -- do not hardcode a universal value.
                             None (default) disables the floor (existing behavior).
        """
        query_vector = self._get_embedding(query_text)

        search_result = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=limit,
            with_payload=True,
            score_threshold=score_threshold,
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

    async def search_similar_post_async(
        self,
        query_text: str,
        limit: int = 10,
        score_threshold: float | None = None,
    ) -> list:
        """Async wrapper -- offloads the blocking Qdrant/embedding call to a thread."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.search_similar_post, query_text, limit, score_threshold
        )

def rrf_fuse(
    raw_results: list[dict],
    expanded_results: list[dict],
    k: int = 60,
) -> list[dict]:
    """Reciprocal Rank Fusion of two ranked result lists.

    Implements Cormack, Clarke & Buettcher (SIGIR 2009): RRF(d) = sum 1/(k + rank(d))
    across each query leg's ranked list. Operates on ranks, not raw scores -- no
    score-scale compatibility required between the two legs.

    Args:
        raw_results:      Ranked list from the raw-query Qdrant search.
        expanded_results: Ranked list from the expanded-query Qdrant search.
        k:                RRF smoothing constant. 60 is the conventional default
                          from the original paper.

    Returns:
        A deduplicated list of result dicts, sorted descending by RRF score.
        The 'score' field is replaced with the RRF score (a float, not a raw
        cosine similarity -- callers must not interpret it as a similarity).
    """
    scores: dict[str, float] = {}
    payloads: dict[str, dict] = {}

    for rank, doc in enumerate(raw_results, start=1):
        uid = doc["uuid"]
        scores[uid] = scores.get(uid, 0.0) + 1.0 / (k + rank)
        payloads[uid] = doc

    for rank, doc in enumerate(expanded_results, start=1):
        uid = doc["uuid"]
        scores[uid] = scores.get(uid, 0.0) + 1.0 / (k + rank)
        payloads.setdefault(uid, doc)

    return [
        {**payloads[uid], "score": round(rrf_score, 6)}
        for uid, rrf_score in sorted(scores.items(), key=lambda x: x[1], reverse=True)
    ]

import numpy as np


def mmr_rerank(
    query_vector: list[float],
    docs: list[dict],
    lambda_param: float = 0.5,
) -> list[dict]:
    """Maximal Marginal Relevance reranking for result diversity.

    Implements Carbonell & Goldstein (SIGIR 1998): greedily select the next
    document that maximises a combination of query relevance and dissimilarity
    from already-selected documents.

        MMR(d) = lambda * sim(d, query) - (1-lambda) * max_{s in Selected} sim(d, s)

    Each doc in `docs` must carry a '_vec' key (list[float]) with its pre-computed
    embedding. Docs missing '_vec' are treated as having zero similarity to all others.

    Args:
        query_vector: Embedding of the user's query (list[float]).
        docs:         Candidate docs from Qdrant with '_vec' key attached.
                      Other keys (uuid, title, description, score) pass through.
        lambda_param: Trade-off weight in [0, 1].
                      1.0 = pure relevance (preserves input order).
                      0.0 = pure diversity.
                      0.5 (default) = balanced.

    Returns:
        All input docs reordered by MMR criterion. The '_vec' key is stripped
        from output dicts (internal use only).
    """
    if not docs:
        return []

    def cosine(a, b):
        a, b = np.array(a, dtype=float), np.array(b, dtype=float)
        denom = np.linalg.norm(a) * np.linalg.norm(b)
        return float(np.dot(a, b) / denom) if denom > 0 else 0.0

    q = np.array(query_vector, dtype=float)
    remaining = list(docs)
    selected: list[dict] = []

    while remaining:
        best_score = -float("inf")
        best_doc = None

        for doc in remaining:
            vec = doc.get("_vec")
            if vec is None:
                relevance = 0.0
                redundancy = 0.0
            else:
                relevance = cosine(q, vec)
                redundancy = (
                    max(cosine(vec, s["_vec"]) for s in selected if s.get("_vec"))
                    if selected
                    else 0.0
                )

            mmr_score = lambda_param * relevance - (1 - lambda_param) * redundancy
            if mmr_score > best_score:
                best_score = mmr_score
                best_doc = doc

        selected.append(best_doc)
        remaining.remove(best_doc)

    # Strip internal _vec key before returning
    return [{k: v for k, v in d.items() if k != "_vec"} for d in selected]
