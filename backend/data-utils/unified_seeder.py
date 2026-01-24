import os
import json
import uuid
import bcrypt
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from fastembed import TextEmbedding

load_dotenv()

# --- Configuration ---
MONGO_URI = f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME")

# --- Data Templates (Mirroring your Node.js seeder) ---
with open('posts_to_seeds.json') as f:
    data = json.load(f)

users_base = data['usersBase']
post_templates = data['postTemplates']

def run_seeder():
    # 1. Initialize Clients
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client.get_database() # Uses default db from URI
    qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    embed_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

    print("🚀 Cleaning existing data...")
    db.users.delete_many({})
    db.posts.delete_many({})
    
    # Reset Qdrant Collection
    qdrant_client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

    # 2. Phase 1: Seed Users
    print("1.Seeding Users...")
    salt = bcrypt.gensalt(rounds=10)
    hashed_pw = bcrypt.hashpw("password123".encode('utf-8'), salt).decode('utf-8')
    user_docs = []
    for u in users_base:
        user_data = {
            **u,
            "useruuid": str(uuid.uuid4()),
            "password": hashed_pw,
            "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed={u['name']}",
            "status": "active"
        }
        result = db.users.insert_one(user_data)
        user_data["_id"] = result.inserted_id # Keep for post referencing
        user_docs.append(user_data)

    # 3. Phase 2: Prepare Posts & Vectors
    print("2. Preparing 50 Posts and generating embeddings...")
    mongo_posts = []
    qdrant_points = []
    
    # Extract texts for batch embedding
    texts_to_embed = []
    post_metadata = []

    for i in range(50):
        author = random.choice(user_docs)
        template = post_templates[i % len(post_templates)]
        post_uuid = str(uuid.uuid4()) # THE SOURCE OF TRUTH ID
        
        created_at = datetime.utcnow() - timedelta(days=random.randint(0, 30))
        full_title = f"{template['title']} #{i}"
        
        # Data for Mongo
        mongo_posts.append({
            "uuid": post_uuid,
            "title": full_title,
            "description": template['description'],
            "author": author["_id"],
            "authorName": author["name"],
            "authorAvatar": author["avatarUrl"],
            "isPublic": True,
            "hashtags": ["tech", "engineering"],
            "createdAt": created_at
        })

        # Prep for Qdrant
        texts_to_embed.append(f"{full_title}. {template['description']}")
        post_metadata.append({"uuid": post_uuid, "title": full_title})

    # 4. Batch Embedding (FastEmbed is great at this)
    embeddings = list(embed_model.embed(texts_to_embed))

    for i, vector in enumerate(embeddings):
        qdrant_points.append(
            PointStruct(
                id=post_metadata[i]["uuid"], # Synchronized ID
                vector=vector.tolist(),
                payload=post_metadata[i]
            )
        )

    # 5. Execute Dual-Write
    print("3.Finalizing Dual-Write...")
    db.posts.insert_many(mongo_posts)
    qdrant_client.upsert(collection_name=COLLECTION_NAME, points=qdrant_points)

    print(f"✅ Success! Seeded {len(user_docs)} Users and 50 Posts (Synchronized).")

if __name__ == "__main__":
    run_seeder()