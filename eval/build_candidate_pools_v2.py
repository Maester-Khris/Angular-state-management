# eval/build_candidate_pools_v2.py
# Usage: python build_candidate_pools_v2.py [--pool-size 20] [--manifest _pipeline_v2/query_manifest.json]
# Requires: MONGO_USERNAME, MONGO_PASSWORD, QDRANT_URL, QDRANT_API_KEY in environment
#
# v2 of eval/build_candidate_pools.py: adds BM25 as a third pooling source (fixing the
# 2-source pooling bias documented in docs/superpowers/specs/2026-08-20-golden-set-rebuild-design.md
# section 3) and excludes corpus-filter-flagged docs from the pool. Candidate order is shuffled
# per query (seeded, deterministic) before saving -- fixes the untested position-bias risk from
# the original pipeline's fixed Mongo-then-Qdrant ordering.

import argparse
import json
import os
import random
import sys

from dotenv import load_dotenv
from fastembed import TextEmbedding
from pymongo import MongoClient
from qdrant_client import QdrantClient

from _pipeline_log import log_stage

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "data-utils", "eval"))
from build_bm25_baseline import build_index as build_bm25_index
from build_bm25_baseline import load_corpus as load_bm25_corpus

import bm25s

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
        coll.create_index([("title", "text"), ("description", "text")])


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


def bm25_search(retriever, uuids: list[str], texts: list[str], query: str, limit: int) -> list[dict]:
    tokens = bm25s.tokenize([query], stopwords="en")
    doc_indices, _scores = retriever.retrieve(tokens, k=min(limit, len(uuids)))
    return [
        {"uuid": uuids[i], "title": texts[i].split(" ", 1)[0], "description": texts[i]}
        for i in doc_indices[0]
    ]


def build_pools(mongo_database: str, mongo_collection: str, qdrant_collection: str, pool_size: int,
                 manifest_path: str, flagged_path: str, corpus_path: str, seed: int) -> tuple[list[dict], int]:
    mongo_coll = MongoClient(build_mongo_uri(mongo_database)).get_database()[mongo_collection]
    ensure_text_index(mongo_coll)

    qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, check_compatibility=False)
    print(f"Loading embedding model '{EMBEDDING_MODEL}'...")
    embed_model = TextEmbedding(model_name=EMBEDDING_MODEL, threads=1)

    print("Building BM25 index over the eval corpus...")
    bm25_uuids, bm25_texts = load_bm25_corpus(corpus_path)
    bm25_retriever = build_bm25_index(bm25_texts)

    # title/description lookup for BM25 hits (BM25 index only stores concatenated text)
    title_desc_by_uuid: dict[str, dict] = {}
    with open(corpus_path, encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            title_desc_by_uuid[rec["uuid"]] = {"title": rec["title"], "description": rec["description"]}

    with open(manifest_path) as f:
        queries = json.load(f)
    with open(flagged_path) as f:
        flagged = set(json.load(f))

    print(f"Building pools for {len(queries)} queries...")
    rng = random.Random(seed)

    pools = []
    empty_count = 0
    for i, q in enumerate(queries, start=1):
        query_text = q["query"]
        text_hits = mongo_text_search(mongo_coll, query_text, pool_size)
        vector_hits = qdrant_search(qdrant, embed_model, qdrant_collection, query_text, pool_size)
        bm25_hits_raw = bm25_search(bm25_retriever, bm25_uuids, bm25_texts, query_text, pool_size)
        bm25_hits = [
            {"uuid": h["uuid"], **title_desc_by_uuid.get(h["uuid"], {"title": h["title"], "description": h["description"]})}
            for h in bm25_hits_raw
        ]

        by_uuid: dict[str, dict] = {}
        for hit in text_hits + vector_hits + bm25_hits:
            if hit["uuid"] in flagged:
                continue
            by_uuid[hit["uuid"]] = {"uuid": hit["uuid"], "title": hit["title"], "description": hit["description"]}

        if q["seed_uuid"] and q["seed_uuid"] not in by_uuid and q["seed_uuid"] not in flagged:
            seed_doc = mongo_coll.find_one({"uuid": q["seed_uuid"]}, {"uuid": 1, "title": 1, "description": 1, "_id": 0})
            if seed_doc:
                by_uuid[seed_doc["uuid"]] = seed_doc

        candidates = list(by_uuid.values())
        rng.shuffle(candidates)  # fixes the fixed-order position-bias risk

        if not candidates:
            empty_count += 1

        pools.append({"query": query_text, "type": q["type"], "seed_uuid": q["seed_uuid"], "candidates": candidates})
        print(f"  [{i}/{len(queries)}] '{query_text}': {len(text_hits)} mongo + {len(vector_hits)} qdrant + {len(bm25_hits)} bm25 -> {len(candidates)} unique")

    return pools, empty_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build 3-source (Mongo+Qdrant+BM25) candidate pools, corpus-filter excluded.")
    parser.add_argument("--mongo-database", default="postair_eval")
    parser.add_argument("--mongo-collection", default="posts")
    parser.add_argument("--qdrant-collection", default="posts_eval")
    parser.add_argument("--pool-size", type=int, default=20)
    parser.add_argument("--manifest", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "query_manifest.json"))
    parser.add_argument("--flagged", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "flagged_uuids.json"))
    parser.add_argument("--corpus", default=os.path.join(os.path.dirname(__file__), "devto_corpus.jsonl"))
    parser.add_argument("--seed", type=int, default=13)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "candidate_pools.json"))
    args = parser.parse_args()

    pools, empty_count = build_pools(args.mongo_database, args.mongo_collection, args.qdrant_collection, args.pool_size,
                                      args.manifest, args.flagged, args.corpus, args.seed)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(pools, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(pools)} query pools to {out_path}")
    log_stage("build_candidate_pools_v2", input_count=len(pools), output_count=len(pools), errors=empty_count)
