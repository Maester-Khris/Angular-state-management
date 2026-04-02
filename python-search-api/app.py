import os
import time
import asyncio
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from services.embedding_service import EmbeddingService
from services.inference import InferenceService
from services.websearch import WebSearchService
import logging


# configure logging
# Force Flask's internal logger to INFO level
app = Flask(__name__)
app.logger.setLevel(logging.INFO)


# --- Security Configuration ---
# Read the allowed origin from environment variables
node_origin = os.getenv("NODE_SERVICE_URL", "http://localhost:3000")
INTERNAL_API_KEY = os.getenv("SHARED_SECURITY_KEY")

# Determine if we are in production
# If FLASK_DEBUG is '0', we assume production mode.
is_prod = os.getenv("FLASK_DEBUG", 1) == 0
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
websearch_svc = WebSearchService() # Initialize the model once on startup

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

        # 1. Similarity Search (Qdrant)
        similar_docs = search_svc.search_similar_post(query, limit=limit)
        
        # 2. Query Expansion (LLM)
        expanded_query = asyncio.run(
            llm_svc.expand_query(query, similar_docs)
        )
        app.logger.info(f"Expanded query: {expanded_query}")

        # 3. Web Search (SerpAPI)
        web_results = asyncio.run(
             websearch_svc.search(expanded_query, limit=8)
        )

        # 4. Source Structuring & Reranking (LLM)
        relevant_ext_docs = asyncio.run(
            llm_svc.generate_relevant_sources(query, web_results)
        )

        return jsonify({
            "query": query,
            "expanded_query": expanded_query,
            "similar_docs": similar_docs,
            "relevant_ext_docs": relevant_ext_docs
        }), 200

    except Exception as e:
        app.logger.error(f"AI Search Pipeline failed: {e}")
        return jsonify({
            "error": "Failed to perform AI search",
            "message": str(e)
        }), 500


@app.route('/web-search', methods=['POST'])
@require_security_key
def web_search():
    """
    Search the web using Serper API (async).
    Expected JSON: {"query": "...", "limit": 5}
    """
    data = request.get_json()
    query = data.get("query")
    limit = data.get("limit", 5)

    if not query:
        return jsonify({"error": "Missing query string"}), 400

    try:
        app.logger.info(f"Web search for: {query}")
        # results = await websearch_svc.search(query, limit=limit)
        result  = asyncio.run(websearch_svc.search(query, limit=limit))
        return jsonify({
            "query": query,
            "count": len(result),
            "results": result
        }), 200
    except Exception as e:
        app.logger.error(f"Web search error: {e}")
        return jsonify({"error": "Failed to perform web search"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)