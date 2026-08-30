# eval/load_mongo_eval.py
# Usage: python load_mongo_eval.py [--in devto_corpus.jsonl] [--database postair_eval] [--collection posts] [--batch-size 500]
# Requires: MONGO_USERNAME, MONGO_PASSWORD in environment (same credentials as production —
#           only --database differs, so no new Doppler secret is needed)
#
# One-time script: bulk-loads the JSONL eval corpus (eval/fetch_devto_dataset.py's output) into
# a dedicated eval-only MongoDB database. Same Atlas cluster as production, different database
# name — full isolation from the real `posts` collection with zero new infra. Drops and
# recreates the target collection each run, so it's safe to re-run after regenerating the corpus.

import argparse
import json
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")

if not MONGO_USERNAME or not MONGO_PASSWORD:
    print("Error: Missing MONGO_USERNAME/MONGO_PASSWORD in environment.", file=sys.stderr)
    sys.exit(1)


def build_uri(database: str) -> str:
    return f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/{database}?appName=Cluster0"


def load_records(path: str) -> list[dict]:
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def load(in_path: str, database: str, collection: str, batch_size: int) -> None:
    records = load_records(in_path)
    print(f"Read {len(records)} records from {in_path}.")

    client = MongoClient(build_uri(database))
    db = client.get_database()
    coll = db[collection]

    existing_count = coll.estimated_document_count()
    if existing_count > 0:
        print(f"Dropping existing '{database}.{collection}' ({existing_count} docs)...")
        coll.drop()

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        coll.insert_many(batch)
        print(f"  inserted {min(i + batch_size, len(records))}/{len(records)}...")

    final_count = coll.count_documents({})
    print(f"Done — {final_count} docs in '{database}.{collection}', expected {len(records)}.")
    assert final_count == len(records), f"Mismatch: inserted {len(records)} but collection has {final_count}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load the JSONL eval corpus into a dedicated eval MongoDB database.")
    parser.add_argument("--in", dest="in_path", default=os.path.join(os.path.dirname(__file__), "devto_corpus.jsonl"))
    parser.add_argument("--database", default="postair_eval")
    parser.add_argument("--collection", default="posts")
    parser.add_argument("--batch-size", type=int, default=500)
    args = parser.parse_args()

    try:
        load(args.in_path, args.database, args.collection, args.batch_size)
    except AssertionError as e:
        print(f"FAILED self-check: {e}", file=sys.stderr)
        sys.exit(1)
