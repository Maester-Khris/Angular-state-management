# data-utils/eval/lexical_mongo.py
# Direct-pymongo replication of node-backend/database/crud.js's searchPostsByKeyword, scoped
# to the isolated postair_eval database. No node-backend call -- same connection pattern as
# eval/load_mongo_eval.py (same Atlas cluster/credentials, different database name only).

import os
import time
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.operations import IndexModel

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


def ensure_search_index(collection: Collection, index_name: str = "posts_lexical_search") -> None:
    """Idempotent -- creates the Atlas Search index node-backend/database/crud.js's fuzzy
    fallback and this file's search_posts_by_keyword_fuzzy both expect. Safe to call every
    run: no-ops if an index with this name already exists. Confirmed live (subgoal2 artifact,
    Item D and the misspelled-query confirming test) that this mechanism only needs to be
    called as a fallback when $text returns zero results -- see search_posts_by_keyword_fuzzy."""
    existing = list(collection.list_search_indexes())
    if any(ix["name"] == index_name for ix in existing):
        return
    collection.create_search_index({
        "name": index_name,
        "definition": {"mappings": {"dynamic": True}},
    })
    deadline = time.time() + 120
    while time.time() < deadline:
        indexes = list(collection.list_search_indexes(index_name))
        if indexes and indexes[0].get("queryable"):
            return
        time.sleep(3)
    raise TimeoutError(f"Search index {index_name!r} did not become queryable within 120s.")


def search_posts_by_keyword_fuzzy(collection: Collection, term: str, limit: int = 10,
                                   index_name: str = "posts_lexical_search") -> list[dict]:
    """Faithful port of crud.js's Atlas Search fuzzy fallback branch. Only meaningful to call
    when search_posts_by_keyword already returned zero results for the same term -- this is a
    fallback, not a general replacement (subgoal2 artifact, Item D: full $search cutover
    regresses ranking on some queries; the fallback-only scope sidesteps that entirely since
    it only ever fires where $text had nothing to lose)."""
    pipeline = [
        {
            "$search": {
                "index": index_name,
                "text": {
                    "query": term,
                    "path": ["title", "description"],
                    "fuzzy": {"maxEdits": 2, "prefixLength": 0},
                },
            }
        },
        {"$match": {"isPublic": True, "isDraft": {"$ne": True}}},
        {"$limit": limit},
    ]
    return list(collection.aggregate(pipeline))


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
