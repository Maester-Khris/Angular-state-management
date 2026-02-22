import os
import time
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from embedding_service import EmbeddingService
import logging


# --- CORS Configuration ---
# Read the allowed origin from environment variables
allowed_origin = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")
INTERNAL_API_KEY = os.getenv("SHARED_SECURITY_KEY")

# configure logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

app = Flask(__name__)
# Force Flask's internal logger to INFO level
app.logger.setLevel(logging.INFO)

CORS(app, resources={
    r"/*": {
        "origins": [allowed_origin],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
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
        logger.info(f"Processing embedding for post: {postuuid} | Title: {title}")
        search_svc.store_post(postuuid, title, description)
        return jsonify({"status": "success", "uuid": postuuid}), 201
    except Exception as e:
        logger.error(f"Error logging post {postuuid}: {e}")
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
        logger.error(f"Search error: {e}")
        return jsonify({"error": "Failed to perform search"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)