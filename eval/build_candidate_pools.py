# eval/build_candidate_pools.py
# Usage: python build_candidate_pools.py [--pool-size 20] [--out _pipeline/candidate_pools.json]
# Requires: MONGO_USERNAME, MONGO_PASSWORD, QDRANT_URL, QDRANT_API_KEY in environment
# Optional: EMBEDDING_MODEL (must match python-search-api/services/embedding_service.py)
#
# One-time script: builds a diverse candidate pool per query by unioning results from two
# independent retrieval methods — Qdrant vector search (posts_eval) and MongoDB's own text
# index (postair_eval.posts) — so relevance judging isn't circular against the single system
# under evaluation (Qdrant alone). For synthetic queries (has a seed_uuid), the seed document
# is injected into the pool directly since it's relevant by construction.

import argparse
import json
import os
import sys

from dotenv import load_dotenv
from fastembed import TextEmbedding
from pymongo import MongoClient
from qdrant_client import QdrantClient

from _pipeline_log import log_stage

load_dotenv()

MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")

if not MONGO_USERNAME or not MONGO_PASSWORD:
    print("Error: Missing MONGO_USERNAME/MONGO_PASSWORD in environment.", file=sys.stderr)
    sys.exit(1)


def build_mongo_uri(database: str) -> str:
    return f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/{database}?appName=Cluster0"


def ensure_text_index(coll) -> None:
    existing = coll.index_information()
    if not any(idx.get("key") and any(v == "text" for _, v in idx["key"]) for idx in existing.values()):
        print("Creating text index on title+description...")
        coll.create_index([("title", "text"), ("description", "text")])
    else:
        print("Text index already exists.")


def load_queries(golden_path: str, synthetic_path: str) -> list[dict]:
    queries = []
    with open(golden_path) as f:
        for entry in json.load(f):
            queries.append({"query": entry["query"], "seed_uuid": None})
    with open(synthetic_path) as f:
        for entry in json.load(f):
            queries.append({"query": entry["query"], "seed_uuid": entry["seed_uuid"]})
    return queries


def mongo_text_search(coll, query: str, limit: int) -> list[dict]:
    cursor = coll.find(
        {"$text": {"$search": query}},
        {"uuid": 1, "title": 1, "description": 1, "score": {"$meta": "textScore"}, "_id": 0},
    ).sort([("score", {"$meta": "textScore"})]).limit(limit)
    return list(cursor)


def qdrant_search(client: QdrantClient, model: TextEmbedding, collection: str, query: str, limit: int) -> list[dict]:
    vector = list(model.embed([query]))[0].tolist()
    hits = client.query_points(collection_name=collection, query=vector, limit=limit, with_payload=True).points
    return [
        {"uuid": h.payload.get("uuid"), "title": h.payload.get("title"), "description": h.payload.get("description")}
        for h in hits
    ]


def build_pools(mongo_database: str, mongo_collection: str, qdrant_collection: str, pool_size: int,
                 golden_path: str, synthetic_path: str) -> tuple[list[dict], int]:
    mongo_coll = MongoClient(build_mongo_uri(mongo_database)).get_database()[mongo_collection]
    ensure_text_index(mongo_coll)

    qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, check_compatibility=False)
    print(f"Loading embedding model '{EMBEDDING_MODEL}'...")
    model = TextEmbedding(model_name=EMBEDDING_MODEL, threads=1)

    queries = load_queries(golden_path, synthetic_path)
    print(f"Building pools for {len(queries)} queries...")

    pools = []
    empty_count = 0
    for i, q in enumerate(queries, start=1):
        query_text = q["query"]
        text_hits = mongo_text_search(mongo_coll, query_text, pool_size)
        vector_hits = qdrant_search(qdrant, model, qdrant_collection, query_text, pool_size)

        by_uuid = {}
        for hit in text_hits + vector_hits:
            by_uuid[hit["uuid"]] = {"uuid": hit["uuid"], "title": hit["title"], "description": hit["description"]}

        if q["seed_uuid"] and q["seed_uuid"] not in by_uuid:
            seed_doc = mongo_coll.find_one({"uuid": q["seed_uuid"]}, {"uuid": 1, "title": 1, "description": 1, "_id": 0})
            if seed_doc:
                by_uuid[seed_doc["uuid"]] = seed_doc

        if not by_uuid:
            empty_count += 1

        pools.append({
            "query": query_text,
            "seed_uuid": q["seed_uuid"],
            "candidates": list(by_uuid.values()),
        })
        print(f"  [{i}/{len(queries)}] '{query_text}': {len(text_hits)} text + {len(vector_hits)} vector -> {len(by_uuid)} unique")

    return pools, empty_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build diverse (text+vector) candidate pools per query.")
    parser.add_argument("--mongo-database", default="postair_eval")
    parser.add_argument("--mongo-collection", default="posts")
    parser.add_argument("--qdrant-collection", default="posts_eval")
    parser.add_argument("--pool-size", type=int, default=20)
    parser.add_argument("--golden", default=os.path.join(os.path.dirname(__file__), "golden_queries.json"))
    parser.add_argument("--synthetic", default=os.path.join(os.path.dirname(__file__), "_pipeline", "synthetic_queries_draft.json"))
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "candidate_pools.json"))
    args = parser.parse_args()

    pools, empty_count = build_pools(args.mongo_database, args.mongo_collection, args.qdrant_collection, args.pool_size,
                                      args.golden, args.synthetic)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(pools, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(pools)} query pools to {out_path}")
    log_stage("build_candidate_pools", input_count=len(pools), output_count=len(pools), errors=empty_count)
