# data-utils/backfill_published_at.py
# Usage: python backfill_published_at.py
# Requires: MONGO_URI in environment (run via doppler or .env)

import os
import random
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

MONGO_URI = (
    f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}"
    f"@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
)

def backfill():
    mongo_uri = MONGO_URI
    if not mongo_uri:
        raise RuntimeError("MONGO_URI environment variable is not set")

    client = MongoClient(mongo_uri)
    db = client.get_default_database()
    posts = db["posts"]

    # Find all posts with missing publishedAt (null or field absent)
    cursor = posts.find({
        "$or": [
            {"publishedAt": None},
            {"publishedAt": {"$exists": False}},
        ]
    })

    now = datetime.now(tz=timezone.utc)
    six_months_ago = now - timedelta(days=182)
    window_seconds = (now - six_months_ago).total_seconds()

    count = 0
    for post in cursor:
        offset = random.random() * window_seconds
        published_at = six_months_ago + timedelta(seconds=offset)
        posts.update_one(
            {"_id": post["_id"]},
            {"$set": {"publishedAt": published_at}},
        )
        count += 1

    print(f"Backfilled publishedAt for {count} posts.")
    client.close()


if __name__ == "__main__":
    backfill()
