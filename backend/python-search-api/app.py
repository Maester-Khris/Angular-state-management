from flask import Flask, request, jsonify
from search_service import SearchService
import logging

# configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
search_svc = SearchService() # Initialize the model once on startup

@app.route('/health', methods=['GET'])
def health_check():
    """Return the server status."""
    return jsonify({
        "status": "OK",
        "service": "postair-search-api",
        "version": "1.0.0",
    }), 200


@app.route('/embed', methods=['POST'])
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

   
    # return jsonify({
    #     "message": f"Post {postuuid} received and logging initiated.",
    #     "status": "received"
    # }), 202


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)