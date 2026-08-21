# eval/sample_docs_for_synthesis.py
# Usage: python sample_docs_for_synthesis.py [--count 30] [--out _pipeline/synthesis_candidates.json] [--seed 7]
# Requires: MONGO_USERNAME, MONGO_PASSWORD in environment
#
# One-time script: samples --count documents from postair_eval.posts, stratified across
# distinct primary hashtags (round-robin across hashtag groups) so synthetic queries generated
# from the sample cover diverse topics rather than clustering on whatever's most common in the
# corpus. Deterministic via --seed.

import argparse
import json
import os
import random
import sys
from collections import defaultdict

from dotenv import load_dotenv
from pymongo import MongoClient

from _pipeline_log import log_stage

load_dotenv()

MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")

if not MONGO_USERNAME or not MONGO_PASSWORD:
    print("Error: Missing MONGO_USERNAME/MONGO_PASSWORD in environment.", file=sys.stderr)
    sys.exit(1)


def build_uri(database: str) -> str:
    return f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/{database}?appName=Cluster0"


def sample(database: str, collection: str, count: int, seed: int, excluded_uuids: set[str]) -> tuple[list[dict], int]:
    client = MongoClient(build_uri(database))
    coll = client.get_database()[collection]

    docs = list(coll.find({}, {"uuid": 1, "title": 1, "description": 1, "hashtags": 1, "_id": 0}))
    print(f"Loaded {len(docs)} docs from {database}.{collection}.")

    docs = [d for d in docs if d["uuid"] not in excluded_uuids]
    print(f"{len(docs)} docs remain after excluding {len(excluded_uuids)} flagged uuids.")

    by_hashtag = defaultdict(list)
    for doc in docs:
        tags = doc.get("hashtags") or ["_none"]
        by_hashtag[tags[0]].append(doc)

    rng = random.Random(seed)
    for group in by_hashtag.values():
        rng.shuffle(group)

    groups = list(by_hashtag.values())
    rng.shuffle(groups)

    sampled = []
    seen_uuids = set()
    i = 0
    while len(sampled) < count and any(groups):
        group = groups[i % len(groups)]
        if group:
            doc = group.pop()
            if doc["uuid"] not in seen_uuids:
                sampled.append(doc)
                seen_uuids.add(doc["uuid"])
        i += 1
        if i > count * 50:  # safety valve against infinite loop on a tiny corpus
            break

    print(f"Sampled {len(sampled)} docs across {len(by_hashtag)} distinct primary hashtags.")
    return sampled, len(docs)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stratified sample of eval corpus docs for synthetic query generation.")
    parser.add_argument("--database", default="postair_eval")
    parser.add_argument("--collection", default="posts")
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--exclude-flagged", default=None, help="Path to a JSON array of uuids to exclude (e.g. _pipeline_v2/flagged_uuids.json)")
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline", "synthesis_candidates.json"))
    args = parser.parse_args()

    excluded = set()
    if args.exclude_flagged:
        with open(args.exclude_flagged) as f:
            excluded = set(json.load(f))

    results, total_docs = sample(args.database, args.collection, args.count, args.seed, excluded)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(results)} sampled docs to {out_path}")
    log_stage("sample_docs_for_synthesis", input_count=total_docs, output_count=len(results), errors=0)
