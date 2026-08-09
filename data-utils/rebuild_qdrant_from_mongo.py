# data-utils/rebuild_qdrant_from_mongo.py
# Usage: python rebuild_qdrant_from_mongo.py [--dry-run] [--batch-size 25]
# Requires: MONGO_USERNAME, MONGO_PASSWORD, MONGO_DATABASE, QDRANT_URL,
#           QDRANT_API_KEY, QDRANT_COLLECTION_NAME in environment
#           (run via `doppler run -- python rebuild_qdrant_from_mongo.py`)
# Optional: EMBEDDING_MODEL (defaults to BAAI/bge-small-en-v1.5, must match
#           python-search-api/services/embedding_service.py exactly)
#
# One-time / recovery tool: Qdrant's free-tier cluster pauses on inactivity and
# can come back empty. MongoDB is the source of truth for posts — this script
# re-embeds every published post from Mongo and rebuilds the Qdrant collection
# from scratch. Idempotent: safe to re-run any time Qdrant needs repopulating.
# Pure CLI — no Flask, no import from python-search-api or node-backend.

import argparse
import os
import sys

from dotenv import load_dotenv
from fastembed import TextEmbedding
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

load_dotenv()

MONGO_URI = (
    f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}"
    f"@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
)
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
VECTOR_SIZE = 384  # BAAI/bge-small-en-v1.5 output dimension — update if EMBEDDING_MODEL changes


def get_embedding(model: TextEmbedding, text: str) -> list[float]:
    return list(model.embed([text]))[0].tolist()


def build_embed_text(post: dict) -> str:
    hashtags = post.get("hashtags") or []
    tag_suffix = f" #{' #'.join(hashtags)}" if hashtags else ""
    return f"{post.get('title', '')}. {post.get('description', '')}{tag_suffix}"


def rebuild(dry_run: bool, batch_size: int) -> None:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client.get_database()

    posts = list(db.posts.find({"status": "published", "isPublic": True}))
    print(f"Found {len(posts)} published posts in MongoDB.")

    if dry_run:
        print("--dry-run: skipping Qdrant writes. Sample of what would be embedded:")
        for post in posts[:5]:
            print(f"  - {post.get('uuid')}: {build_embed_text(post)[:80]}...")
        return

    print(f"Loading embedding model '{EMBEDDING_MODEL}'...")
    model = TextEmbedding(model_name=EMBEDDING_MODEL, threads=1)

    qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60, check_compatibility=False)

    existing = [c.name for c in qdrant.get_collections().collections]
    if COLLECTION_NAME in existing:
        print(f"Deleting existing Qdrant collection '{COLLECTION_NAME}'...")
        qdrant.delete_collection(collection_name=COLLECTION_NAME)
    else:
        print(f"Collection '{COLLECTION_NAME}' does not exist yet — creating fresh.")

    print(f"Creating Qdrant collection '{COLLECTION_NAME}'...")
    qdrant.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )

    points = []
    for i, post in enumerate(posts, start=1):
        post_uuid = post.get("uuid")
        if not post_uuid:
            print(f"  skipping post {post.get('_id')} — missing uuid")
            continue

        vector = get_embedding(model, build_embed_text(post))
        points.append(
            PointStruct(
                id=post_uuid,
                vector=vector,
                payload={
                    "uuid": post_uuid,
                    "title": post.get("title", ""),
                    "description": post.get("description", ""),
                },
            )
        )

        if i % batch_size == 0 or i == len(posts):
            print(f"  embedded {i}/{len(posts)}...")
            qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
            points = []

    # Self-check: Qdrant point count must match what we intended to write
    count = qdrant.count(collection_name=COLLECTION_NAME).count
    expected = len([p for p in posts if p.get("uuid")])
    print(f"Done — {count} vectors in Qdrant, expected {expected}.")
    assert count == expected, f"Mismatch: wrote {expected} posts but Qdrant has {count}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rebuild the Qdrant collection from live MongoDB posts.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be embedded, write nothing.")
    parser.add_argument("--batch-size", type=int, default=25, help="Posts per Qdrant upsert batch.")
    args = parser.parse_args()

    try:
        rebuild(dry_run=args.dry_run, batch_size=args.batch_size)
    except AssertionError as e:
        print(f"FAILED self-check: {e}", file=sys.stderr)
        sys.exit(1)
