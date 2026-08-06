# data-utils/seed_e2e_account.py
# Usage: python seed_e2e_account.py
# Requires: MONGO_USERNAME, MONGO_PASSWORD, MONGO_DATABASE, E2E_TEST_PASSWORD
#           in environment (run via `doppler run --config test -- python seed_e2e_account.py`)
#
# Seeds one persistent, pre-verified writer account for Playwright E2E tests.
# Idempotent — upserts by email, safe to re-run. Bcrypt hash matches
# node-backend/auth/authUtils.js's hashPassword() exactly (bcrypt, 10 salt rounds),
# so the account authenticates through the real POST /auth/login endpoint unchanged.

import os
import uuid
from datetime import datetime, timezone

import bcrypt
from pymongo import MongoClient

MONGO_URI = (
    f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}"
    f"@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
)

# Namespaced distinctly from the Vitest integration tests' `int-test-writer@postair.test`
# to avoid any collision or cross-suite cleanup interference on the shared test cluster.
E2E_TEST_EMAIL = "e2e-test-writer@postair.test"
E2E_TEST_NAME = "E2E Test Writer"
SALT_ROUNDS = 10


def seed():
    password = os.getenv("E2E_TEST_PASSWORD")
    if not password:
        raise RuntimeError(
            "E2E_TEST_PASSWORD environment variable is not set — "
            "add it to the Doppler `test` config before running this script."
        )

    mongo_uri = MONGO_URI
    if not os.getenv("MONGO_USERNAME") or not os.getenv("MONGO_DATABASE"):
        raise RuntimeError("MONGO_USERNAME/MONGO_PASSWORD/MONGO_DATABASE are not set")

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(SALT_ROUNDS)).decode("utf-8")

    client = MongoClient(mongo_uri)
    db = client.get_default_database()
    users = db["users"]

    now = datetime.now(tz=timezone.utc)
    result = users.update_one(
        {"email": E2E_TEST_EMAIL},
        {
            "$set": {
                "password": hashed,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "useruuid": str(uuid.uuid4()),
                "name": E2E_TEST_NAME,
                "isVerified": True,
                "avatarUrl": "default-avatar",
                "bio": "",
                "status": "active",
                "createdAt": now,
            },
        },
        upsert=True,
    )

    if result.upserted_id:
        print(f"Created E2E test account: {E2E_TEST_EMAIL} (_id={result.upserted_id})")
    else:
        print(f"E2E test account already existed, password refreshed: {E2E_TEST_EMAIL}")

    client.close()


if __name__ == "__main__":
    seed()
