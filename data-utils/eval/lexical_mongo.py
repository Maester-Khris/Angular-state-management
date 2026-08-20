# data-utils/eval/lexical_mongo.py
# Direct-pymongo replication of node-backend/database/crud.js's searchPostsByKeyword, scoped
# to the isolated postair_eval database. No node-backend call -- same connection pattern as
# eval/load_mongo_eval.py (same Atlas cluster/credentials, different database name only).

import os

from pymongo import MongoClient
from pymongo.collection import Collection

MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")


def build_uri(database: str) -> str:
    return f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/{database}?appName=Cluster0"


def get_collection(database: str = "postair_eval", collection: str = "posts") -> Collection:
    client = MongoClient(build_uri(database))
    return client.get_database().get_collection(collection)


def ensure_text_index(collection: Collection) -> None:
    """Idempotent -- matches the text index node-backend/database/models/post.js:55 declares
    via Mongoose (PostSchema.index({ title: 'text', description: 'text' })), which the eval
    database never got since it was bulk-loaded via raw pymongo insert_many, not Mongoose.
    Safe to call every run: create_index no-ops if an equivalent index already exists."""
    collection.create_index([("title", "text"), ("description", "text")])


def search_posts_by_keyword(collection: Collection, term: str, limit: int = 10) -> list[dict]:
    """Faithful port of node-backend/database/crud.js:170-180's searchPostsByKeyword -- same
    filter, same $meta textScore sort, same limit. isDraft absent on eval docs is fine: Mongo's
    $ne matches missing fields the same way it does in production."""
    cursor = (
        collection.find(
            {"$text": {"$search": term}, "isPublic": True, "isDraft": {"$ne": True}},
            {"score": {"$meta": "textScore"}},
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(limit)
    )
    return list(cursor)
