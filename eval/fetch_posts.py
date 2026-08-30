# eval/fetch_posts.py
# Usage: python eval/fetch_posts.py [--limit 50] [--out eval/posts.json]
# Requires: MONGO_USERNAME, MONGO_PASSWORD, MONGO_DATABASE in environment
#           (e.g., via `doppler run -- python eval/fetch_posts.py` or `.env` file)
#
# Standalone CLI script: Fetches published posts from MongoDB and saves them to JSON for eval ground-truth labeling.

import argparse
import json
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
MONGO_DATABASE = os.getenv("MONGO_DATABASE")

if not MONGO_USERNAME or not MONGO_PASSWORD or not MONGO_DATABASE:
    # Try building MONGO_URI directly if set
    MONGO_URI = os.getenv("MONGO_URI")
    if not MONGO_URI:
        print("Error: Missing MongoDB credentials (MONGO_USERNAME, MONGO_PASSWORD, MONGO_DATABASE or MONGO_URI).")
        sys.exit(1)
else:
    MONGO_URI = (
        f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}"
        f"@cluster0.sgdzstx.mongodb.net/{MONGO_DATABASE}?appName=Cluster0"
    )


def json_serializer(obj):
    """JSON serializer for MongoDB BSON types (ObjectId, datetime)."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


def fetch_posts(limit: int = 50) -> list[dict]:
    client = MongoClient(MONGO_URI)
    db = client.get_database()

    query = {"status": "published", "isPublic": True}
    posts_cursor = db.posts.find(query).limit(limit)

    posts = []
    for post in posts_cursor:
        post["_id"] = str(post["_id"])
        if "author" in post:
            post["author"] = str(post["author"])
        if "editors" in post:
            post["editors"] = [str(e) for e in post.get("editors", [])]
        posts.append(post)

    print(f"Retrieved {len(posts)} posts from MongoDB.")
    return posts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch posts from MongoDB for eval dataset.")
    parser.add_argument("--limit", type=int, default=50, help="Maximum number of posts to fetch (default: 50)")
    parser.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(__file__), "posts.json"),
        help="Output JSON file path (default: eval/posts.json)",
    )
    args = parser.parse_args()

    posts = fetch_posts(limit=args.limit)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(posts, f, indent=2, default=json_serializer, ensure_ascii=False)

    print(f"Saved {len(posts)} posts to {out_path}")
