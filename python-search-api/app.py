import os
import time
import asyncio
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from services.embedding_service import EmbeddingService, rrf_fuse, mmr_rerank
from services.inference import InferenceService
from services.reranking_service import RerankingService
from services.search_providers.exa_provider import ExaWebSearchAdapter
import logging


# configure logging
# Force Flask's internal logger to INFO level
app = Flask(__name__)
app.logger.setLevel(logging.INFO)


# --- Security Configuration ---
# Read the allowed origin from environment variables
node_origin = os.getenv("NODE_SERVICE_URL", "http://localhost:3000")
INTERNAL_API_KEY = os.getenv("NODE_SHARED_SECURITY_KEY")

# --- Model setup ---
# FLASK_DEBUG=0 means production
is_prod = os.getenv("PYTHON_FLASK_DEBUG", "1") == "0"
allowed_origins = [node_origin]
print(f"is prod: {is_prod}")

if not is_prod:
    # Add local development domains if not in production
    dev_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    for origin in dev_origins:
        if origin not in allowed_origins:
            allowed_origins.append(origin)

CORS(app, resources={
    r"/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Internal-Key"]
    }
})


# --- Request/Response Logging (Morgan style) ---
@app.before_request
def start_timer():
    request.start_time = time.time()

@app.after_request
def log_request(response):
    if request.path == '/favicon.ico':
        return response
    
    # Calculate duration in ms
    duration = 0
    if hasattr(request, 'start_time'):
        duration = round((time.time() - request.start_time) * 1000, 2)
    
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '-')
    method = request.method
    path = request.path
    status = response.status_code
    content_length = response.content_length or 0
    ua = request.headers.get('User-Agent', '-')

    # Format: :method :url :status :res[content-length] - :response-time ms :remote-addr :user-agent
    log_line = f"{method} {path} {status} {content_length} - {duration} ms {ip} {ua}"
    app.logger.info(log_line)

    return response


search_svc = EmbeddingService() # Initialize the model once on startup
llm_svc = InferenceService() # Initialize the model once on startup
websearch_svc = ExaWebSearchAdapter() # Initialize the model once on startup
rerank_svc = RerankingService() # Initialize the model once on startup

# Empirically calibrated similarity floor for BAAI/bge-small-en-v1.5 on this corpus.
# Set via sweep_score_threshold.py output. None = disabled (full top-K always returned).
_env_threshold = os.environ.get("SCORE_THRESHOLD")
SCORE_THRESHOLD: float | None = float(_env_threshold) if _env_threshold else None

# --- Eager warmup: force all services to fully initialize before accepting requests ---
# This prevents "Lazy Loading" from happening mid-request and eliminates cold-start failures.
with app.app_context():
    try:
        app.logger.info("Startup: warming up EmbeddingService...")
        search_svc.search_similar_post("warmup", limit=1)
        app.logger.info("Startup: EmbeddingService ready.")
    except Exception as e:
        app.logger.warning(f"Startup warmup failed (non-fatal): {e}")

        

# --- Middleware ---
def require_security_key(f):
    """
    Middleware decorator to verify the internal API key.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Extract key from header
        provided_key = request.headers.get('X-Internal-Key')
        
        # 2. Compare with our environment variable
        # Note: We use 'is None' check to prevent access if the env var isn't set
        if not INTERNAL_API_KEY or provided_key != INTERNAL_API_KEY:
            return jsonify({
                "error": "Unauthorized",
                "message": "Invalid or missing Internal API Key."
            }), 401
            
        return f(*args, **kwargs)
    return decorated_function


# --- Routes ---
@app.route('/', methods=['GET'])
def index():
    """
    Root endpoint for the Search Engine.
    Used for basic connectivity testing.
    """
    return jsonify({
        "message": "PostAir Semantic Search Engine is Active",
        "documentation": "Endpoints: /health, /search, /embed",
        "status": "online"
    }), 200


@app.route('/health', methods=['GET'])
def health_check():
    """Return the server status."""
    return jsonify({
        "status": "OK",
        "service": "postair-search-api",
        "version": "1.0.0",
    }), 200


@app.route('/ping', methods=['GET'])
def ping():
    """
    Public keepalive — real Qdrant round trip, no auth (hit by an external cron
    pinger to stop the free-tier cluster from pausing on inactivity).
    """
    try:
        search_svc.ping()
        return jsonify({"qdrant": "up"}), 200
    except Exception as e:
        app.logger.warning(f"Ping: Qdrant unreachable: {e}")
        return jsonify({"qdrant": "down", "message": str(e)}), 503


@app.route('/embed', methods=['POST'])
@require_security_key
def embed_post():
    """
    Receive a post data logs its and embeds it.
    Expected JSON :{"postuuid":"...", "title":"...", "description":"..."}
    """
    data = request.get_json()

    #Basic validation
    if not data or "postuuid" not in data:
        return jsonify({"error": "Missing postuuid"}), 400

    postuuid = data.get("postuuid")
    title = data.get("title", "")
    description = data.get("description", "")

    try:
        app.logger.info(f"Processing embedding for post: {postuuid} | Title: {title}")
        search_svc.store_post(postuuid, title, description)
        return jsonify({"status": "success", "uuid": postuuid}), 201
    except Exception as e:
        app.logger.error(f"Error logging post {postuuid}: {e}")
        return jsonify({"error": f"Error logging post {postuuid}: {e}"}), 500

   
@app.route('/search', methods=['POST'])
@require_security_key
def search():
    """
    Search for posts semantically.
    Expected JSON: {"query": "...", "limit": 5}
    Default to top 5 if limit isn't provided
    """
    data = request.get_json()
    query = data.get("query")
    limit = data.get("limit", 5)

    if not query:
        return jsonify({"error": "Missing query string"}), 400

    try:
        results = search_svc.search_similar_post(query, limit=limit)
        return jsonify({
            "query": query,
            "count": len(results),
            "results": results
        }), 200
    except Exception as e:
        app.logger.error(f"Search error: {e}")
        return jsonify({"error": "Failed to perform search"}), 500



@app.route('/search-augmented', methods=['POST'])
@require_security_key
def search_augmented():
    """
    [DEPRECATED] Use /search/ai for the full AI search pipeline.
    Search for posts semantically and augment with source structuring.
    """
    data = request.get_json()
    query = data.get("query")
    limit = data.get("limit", 5)

    if not query:
        return jsonify({"error": "Missing query string"}), 400

    try:
        results = search_svc.search_similar_post(query, limit=limit)
        relevant_sources = asyncio.run(
            llm_svc.generate_relevant_sources(query, results)
        )

        return jsonify({
            "query": query,
            "count": len(results),
            "results": results,
            "relevant_sources": relevant_sources
        }), 200
    except Exception as e:
        app.logger.error(f"Search augmented error: {e}")
        return jsonify({"error": "Failed to perform search"}), 500


async def _soft_fail(coro_or_callable, leg_name: str, fallback, log_prefix: str):
    """Run a coroutine or callable. If it fails, log and return (fallback, leg_name)."""
    try:
        if asyncio.iscoroutine(coro_or_callable):
            res = await coro_or_callable
        elif asyncio.iscoroutinefunction(coro_or_callable):
            res = await coro_or_callable()
        else:
            res = coro_or_callable()
        return res, None
    except Exception as e:
        app.logger.warning(f"{log_prefix} degraded: {e}")
        return fallback, leg_name


async def _fetch_and_fuse_candidates(query: str, candidate_limit: int):
    qdrant_task = search_svc.search_similar_post_async(query, limit=candidate_limit, score_threshold=SCORE_THRESHOLD)
    expand_task = llm_svc.expand_query(query)

    raw_results = await qdrant_task  # hard failure propagates
    degraded = []

    expanded_query, exp_deg = await _soft_fail(
        expand_task, "expansion", query, "Expansion leg"
    )
    if exp_deg:
        degraded.append(exp_deg)
    else:
        app.logger.info(f"Expanded query: {expanded_query}")

    expanded_results, exp_q_deg = await _soft_fail(
        search_svc.search_similar_post_async(expanded_query, limit=candidate_limit, score_threshold=SCORE_THRESHOLD),
        "expanded_retrieval", [], "Expanded Qdrant leg"
    )
    if exp_q_deg:
        degraded.append(exp_q_deg)

    fused_docs = rrf_fuse(raw_results, expanded_results, k=60)
    return expanded_query, fused_docs, degraded


async def _apply_internal_reranking(query: str, fused_docs: list[dict]):
    reranked, deg = await _soft_fail(
        lambda: rerank_svc.rerank(query, fused_docs),
        "reranking_internal", fused_docs, "Reranking (internal) leg"
    )
    return reranked, [deg] if deg else []


async def _apply_diversity_rerank(reranked_docs: list[dict]):
    def _do_mmr():
        for doc in reranked_docs:
            if "_vec" not in doc:
                doc["_vec"] = search_svc._get_embedding(f"{doc.get('title', '')}. {doc.get('description', '')}")
        return mmr_rerank(reranked_docs, lambda_param=0.5)

    diverse_docs, deg = await _soft_fail(
        _do_mmr, "mmr_diversity", reranked_docs, "MMR diversity leg"
    )
    return diverse_docs, [deg] if deg else []


async def _fetch_web_results(expanded_query: str):
    web_results, deg = await _soft_fail(
        websearch_svc.search(expanded_query, limit=8),
        "web_search", [], "Web search leg"
    )
    if not web_results and not deg:
        deg = "web_search"
    return web_results, [deg] if deg else []


async def _build_external_sources(query: str, web_results):
    def _do_llm():
        web_results_dicts = [
            {"title": r.title, "url": r.url, "favicon": r.favicon, "description": r.snippet}
            for r in web_results
        ]
        return llm_svc.generate_relevant_sources(query, web_results_dicts)

    ext_docs, deg = await _soft_fail(
        _do_llm(), "reranking", [], "Reranking leg"
    )
    return ext_docs, [deg] if deg else []


async def _search_ai_pipeline(query: str, limit: int) -> dict:
    degraded_legs: list[str] = []
    candidate_limit = limit * 3

    expanded_query, fused_docs, deg1 = await _fetch_and_fuse_candidates(query, candidate_limit)
    degraded_legs.extend(deg1)

    reranked_docs, deg2 = await _apply_internal_reranking(query, fused_docs)
    degraded_legs.extend(deg2)

    diverse_docs, deg3 = await _apply_diversity_rerank(reranked_docs)
    degraded_legs.extend(deg3)

    similar_docs = diverse_docs[:limit]

    web_results, deg4 = await _fetch_web_results(expanded_query)
    degraded_legs.extend(deg4)

    relevant_ext_docs, deg5 = await _build_external_sources(query, web_results)
    if deg5 and "web_search" not in degraded_legs:
        degraded_legs.extend(deg5)

    return {
        "query": query,
        "expanded_query": expanded_query,
        "similar_docs": similar_docs,
        "relevant_ext_docs": relevant_ext_docs,
        "degraded_legs": degraded_legs,
    }


@app.route('/search/ai', methods=['POST'])
@require_security_key
def search_ai():
    """
    Full AI Search Pipeline:
    Qdrant Similarity -> LLM Expansion -> SerpAPI Web Search -> LLM Source Structuring.
    Expected JSON: {"query": "...", "limit": 5}
    """
    data = request.get_json()
    query = data.get("query")
    limit = data.get("limit", 5)
    print(f"query: {query}")
    print(f"limit: {limit}")

    if not query:
        return jsonify({"error": "Missing query string"}), 400

    try:
        app.logger.info(f"AI Search starting for query: {query}")
        result = asyncio.run(_search_ai_pipeline(query, limit))
        return jsonify(result), 200

    except Exception as e:
        app.logger.error(f"AI Search Pipeline failed: {e}")
        return jsonify({
            "error": "Failed to perform AI search",
            "message": str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)