import os
import sys
from pymongo import MongoClient
from pymongo.errors import BulkWriteError

MONGO_URI = (
    f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}"
    f"@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
)
if not MONGO_URI:
    print("ERROR: MONGO_URI is not set. Run via: doppler run -- python seed-tags.py")
    sys.exit(1)

TAGS = [
    # Languages
    "javascript", "typescript", "python", "rust", "golang",
    "java", "kotlin", "swift", "cpp", "ruby", "php", "scala", "elixir",

    # Frontend
    "angular", "react", "vue", "svelte", "css", "html", "web-components",

    # Backend & runtimes
    "nodejs", "deno", "fastapi", "django", "spring", "nestjs", "express",

    # Databases
    "postgresql", "mongodb", "redis", "mysql", "sqlite",
    "elasticsearch", "cassandra", "dynamodb",

    # Infrastructure & DevOps
    "docker", "kubernetes", "devops", "cicd", "terraform",
    "aws", "gcp", "azure", "serverless", "linux",

    # Architecture & Design
    "system-design", "architecture", "microservices", "api",
    "rest", "graphql", "grpc", "event-driven", "distributed-systems",

    # AI & Data
    "machine-learning", "deep-learning", "llm", "data-science",
    "data-engineering", "mlops",

    # Engineering practices
    "testing", "performance", "security", "observability",
    "algorithms", "data-structures", "design-patterns",
    "concurrency", "open-source", "debugging",
]

def main():
    client = MongoClient(MONGO_URI)
    try:
        db = client.get_default_database()
        collection = db["tags"]

        docs = [{"name": tag} for tag in TAGS]

        inserted = 0
        skipped = 0

        try:
            result = collection.insert_many(docs, ordered=False)
            inserted = len(result.inserted_ids)
        except BulkWriteError as e:
            inserted = e.details.get("nInserted", 0)
            duplicate_errors = [err for err in e.details.get("writeErrors", []) if err.get("code") == 11000]
            other_errors = [err for err in e.details.get("writeErrors", []) if err.get("code") != 11000]
            skipped = len(duplicate_errors)
            if other_errors:
                print(f"Unexpected write errors: {other_errors}")
                sys.exit(1)

        print(f"Tags inserted: {inserted}  |  already existed (skipped): {skipped}")
        print(f"Total tags in seed list: {len(TAGS)}")

    finally:
        client.close()

if __name__ == "__main__":
    main()
