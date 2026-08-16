"""Cross-encoder reranking service using FastEmbed's TextCrossEncoder.

Reranks a candidate list from Qdrant (bi-encoder retrieval) using a small
cross-encoder model that applies token-level cross-attention between the query
and each document -- better at breaking near-tied cosine-similarity scores than
a single-vector comparison.

Model: Xenova/ms-marco-MiniLM-L-6-v2 (0.08 GB, CPU only)
  - Smallest model in FastEmbed's cross-encoder lineup.
  - Trained on MS MARCO passage-ranking data (real Bing query/passage labels).
  - threads=1 is mandatory for Railway/Render hobby-tier to prevent OOM/CPU spikes;
    same constraint as the embedding model in embedding_service.py.
"""

from fastembed.rerank.cross_encoder import TextCrossEncoder

RERANKER_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2"


class RerankingService:
    def __init__(self):
        # Lazy-loaded -- model is not downloaded/initialized until first rerank() call.
        self.reranker: TextCrossEncoder | None = None

    def _initialize_resources(self):
        """Load the cross-encoder model once on first use.

        Follows the same lazy-init pattern as EmbeddingService._initialize_resources.
        threads=1 is critical for CPU-only hobby-tier deployment.
        """
        if self.reranker is None:
            print(f"Lazy Loading: Initializing cross-encoder ({RERANKER_MODEL})...")
            self.reranker = TextCrossEncoder(
                model_name=RERANKER_MODEL,
                threads=1,
            )

    def rerank(self, query: str, docs: list[dict]) -> list[dict]:
        """Rerank a candidate list using cross-encoder relevance scores.

        Retrieves cross-encoder scores for each (query, doc_text) pair and
        returns the same dicts sorted descending by relevance. The original
        doc dicts are returned unmodified -- the cross-encoder score is used
        only for ordering, not added to the payload.

        Args:
            query: The original user search query (not the expanded query --
                   the cross-encoder scores relevance to what the user typed).
            docs:  List of candidate result dicts from Qdrant, each with at
                   minimum: uuid, title, description, score.

        Returns:
            The same dicts as `docs`, sorted descending by cross-encoder
            relevance score. Returns [] if docs is empty (model not loaded).
        """
        if not docs:
            return []

        self._initialize_resources()

        # Build the text representation for each candidate.
        # Use "title. description" -- same concatenation as the stored embedding,
        # so the cross-encoder sees the same content shape as the indexing step.
        doc_texts = [f"{d.get('title', '')}. {d.get('description', '')}" for d in docs]

        scores = list(self.reranker.rerank(query, doc_texts))

        # Pair each doc with its cross-encoder score, sort descending, strip the score.
        ranked = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
        return [doc for _, doc in ranked]
