
import os
import json
import uuid
import bcrypt
import random
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from fastembed import TextEmbedding

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MONGO_URI = (
    f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}"
    f"@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
)
QDRANT_URL        = os.getenv("QDRANT_URL")
QDRANT_API_KEY    = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME   = os.getenv("QDRANT_COLLECTION_NAME")

# ---------------------------------------------------------------------------
# Domain-relevant hashtag pool — randomly assigned (1–2 per post)
# ---------------------------------------------------------------------------
HASHTAG_POOL = [
    "webdev", "frontend", "backend", "fullstack", "javascript", "typescript",
    "nodejs", "react", "css", "api", "devops", "docker", "kubernetes", "cicd",
    "cloud", "aws", "azure", "serverless", "terraform", "microservices",
    "ai", "llm", "machinelearning", "rag", "promptengineering", "openai",
    "data", "postgresql", "redis", "spark", "dbt", "airflow", "dataops",
    "cybersecurity", "performance", "testing", "observability", "oss",
]

# ---------------------------------------------------------------------------
# Load seed data
# ---------------------------------------------------------------------------
with open("images.json") as f:
    data = json.load(f)          # flat list of image URLs
    image_pool = data['wallpapers']

with open("seed.json") as f:
    seed_data = json.load(f)

users_base     = seed_data["usersBase"]
post_templates = seed_data["postTemplates"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """Convert a title to a URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text


def unique_slug(base_slug: str, seen: set) -> str:
    """Append a numeric suffix when a slug has already been used."""
    slug = base_slug
    counter = 1
    while slug in seen:
        slug = f"{base_slug}-{counter}"
        counter += 1
    seen.add(slug)
    return slug


def estimate_read_time(text: str) -> int:
    """Estimate reading time in minutes (avg 200 wpm)."""
    words = len(text.split())
    return max(1, round(words / 200))


def skewed_date(max_days: int = 60) -> datetime:
    """
    Return a random past datetime skewed toward recent dates.
    Uses a square-root distribution so recent posts are denser.
    """
    fraction = random.random() ** 2          # squaring skews toward 0 (recent)
    days_ago = int(fraction * max_days)
    hours_ago = random.randint(0, 23)
    return datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)


def pick_images(pool: list, avg: int = 2, max_count: int = 4) -> list:
    """Return 1–max_count images, distributed around avg."""
    weights = [1, avg, avg - 1, 1]          # 1 img, 2 imgs, 3 imgs, 4 imgs
    count = random.choices(range(1, max_count + 1), weights=weights)[0]
    return random.sample(pool, min(count, len(pool)))


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

def run_seeder():
    # 1. Init clients
    mongo_client = MongoClient(MONGO_URI)
    db           = mongo_client.get_database()
    qdrant       = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    embed_model  = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

    # ------------------------------------------------------------------
    # 2. Wipe ALL existing data
    # ------------------------------------------------------------------
    print("🧹 Dropping all MongoDB collections...")
    for name in db.list_collection_names():
        db.drop_collection(name)
        print(f"   ✗ dropped collection: {name}")

    print("🧹 Recreating Qdrant collection...")
    qdrant.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

    # ------------------------------------------------------------------
    # 3. Seed users
    # ------------------------------------------------------------------
    print("\n👤 Seeding users...")
    salt       = bcrypt.gensalt(rounds=10)
    hashed_pw  = bcrypt.hashpw(b"password123", salt).decode()
    user_docs  = []

    for u in users_base:
        doc = {
            **u,
            "useruuid":  str(uuid.uuid4()),
            "password":  hashed_pw,
            "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed={u['name']}",
            "status":    "active",
            "createdAt": skewed_date(max_days=180),
        }
        result = db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
        user_docs.append(doc)

    print(f"   ✓ {len(user_docs)} users inserted")

    # ------------------------------------------------------------------
    # 4. Build posts
    # ------------------------------------------------------------------
    print("\n📝 Preparing 50 posts and generating embeddings...")

    seen_slugs   = set()
    mongo_posts  = []
    qdrant_points = []
    texts_to_embed = []
    post_meta    = []

    for i, template in enumerate(post_templates):
        author    = random.choice(user_docs)
        post_uuid = str(uuid.uuid4())
        hashtags  = random.sample(HASHTAG_POOL, k=random.randint(1, 2))
        images    = pick_images(image_pool)
        created   = skewed_date(max_days=60)

        # Slug: derived from title, guaranteed unique
        base_slug = slugify(template["title"])
        slug      = unique_slug(base_slug, seen_slugs)

        # Read time based on description
        read_time = estimate_read_time(template["description"])

        mongo_posts.append({
            "uuid":         post_uuid,
            "slug":         slug,
            "title":        template["title"],
            "description":  template["description"],
            "author":       author["_id"],
            "authorName":   author["name"],
            "authorAvatar": author["avatarUrl"],
            "status":       "published",
            "isPublic":     True,
            "images":       images,
            "hashtags":     hashtags,
            "readTime":     read_time,          # minutes
            "likes":        random.randint(0, 340),
            "views":        random.randint(10, 4800),
            "createdAt":    created,
            "updatedAt":    created,
        })

        # Embed: title + description + hashtags for rich semantic context
        embed_text = (
            f"{template['title']}. "
            f"{template['description']} "
            f"#{' #'.join(hashtags)}"
        )
        texts_to_embed.append(embed_text)
        post_meta.append({
            "uuid":        post_uuid,
            "slug":        slug,
            "title":       template["title"],
            "description": template["description"],
            "hashtags":    hashtags,
        })

    # ------------------------------------------------------------------
    # 5. Batch embed
    # ------------------------------------------------------------------
    print("   ⚙️  Generating embeddings (batch)...")
    embeddings = list(embed_model.embed(texts_to_embed))

    for i, vector in enumerate(embeddings):
        qdrant_points.append(
            PointStruct(
                id      = post_meta[i]["uuid"],
                vector  = vector.tolist(),
                payload = post_meta[i],         # uuid, slug, title, description, hashtags
            )
        )

    # ------------------------------------------------------------------
    # 6. Dual-write
    # ------------------------------------------------------------------
    print("   💾 Writing to MongoDB...")
    db.posts.insert_many(mongo_posts)

    print("   💾 Upserting to Qdrant...")
    qdrant.upsert(collection_name=COLLECTION_NAME, points=qdrant_points)

    print(
        f"\n✅ Done — {len(user_docs)} users · {len(mongo_posts)} posts · "
        f"{len(qdrant_points)} vectors synchronized."
    )


if __name__ == "__main__":
    run_seeder()


# import os
# import requests
# import json
# import uuid
# import bcrypt
# import random
# from datetime import datetime, timedelta
# from dotenv import load_dotenv
# from pymongo import MongoClient
# from qdrant_client import QdrantClient
# from qdrant_client.models import PointStruct, VectorParams, Distance
# from fastembed import TextEmbedding

# load_dotenv()

# # --- Configuration ---
# MONGO_URI = f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
# QDRANT_URL = os.getenv("QDRANT_URL")
# QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
# COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME")

# # --- Data Templates (Mirroring your Node.js seeder) ---
# with open('images.json') as f:
#     image_pool = json.load(f)

# with open('posts_to_seeds.json') as f:
#     data = json.load(f)

# users_base = data['usersBase']
# post_templates = data['postTemplates']
# image_pool = data['wallpapers']

# # Deprecated: will use image.json data
# def fetch_image_pool():
#     print("📸 Fetching image pool from Picsum...")
#     try:
#         # Use the list API to get 50 creative images
#         response = requests.get("https://picsum.photos/v2/list?page=2&limit=50", timeout=10)
#         response.raise_for_status()
#         return [img['download_url'] for img in response.json()]
#     except Exception as e:
#         print(f"⚠️ Warning: Could not fetch images: {e}. Using fallback placeholders.")
#         return ["https://picsum.photos/seed/picsum/800/600"]

# def run_seeder():
#     # 1. Initialize Clients
#     mongo_client = MongoClient(MONGO_URI)
#     db = mongo_client.get_database() # Uses default db from URI
#     qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
#     embed_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

#     print("🚀 Cleaning existing data...")
#     db.users.delete_many({})
#     db.posts.delete_many({}) # must ipdate to delete all collection not post only
    
#     # Reset Qdrant Collection
#     qdrant_client.recreate_collection(
#         collection_name=COLLECTION_NAME,
#         vectors_config=VectorParams(size=384, distance=Distance.COSINE),
#     )

#     # 2. Phase 1: Prepare Image Pool
#     image_pool = fetch_image_pool()

#     # 3. Phase 2: Seed Users
#     print("1.Seeding Users...")
#     salt = bcrypt.gensalt(rounds=10)
#     hashed_pw = bcrypt.hashpw("password123".encode('utf-8'), salt).decode('utf-8')
#     user_docs = []
#     for u in users_base:
#         user_data = {
#             **u,
#             "useruuid": str(uuid.uuid4()),
#             "password": hashed_pw,
#             "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed={u['name']}",
#             "status": "active"
#         }
#         result = db.users.insert_one(user_data)
#         user_data["_id"] = result.inserted_id # Keep for post referencing
#         user_docs.append(user_data)

#     # 4. Phase 3: Prepare Posts & Vectors
#     print("2. Preparing 50 Posts and generating embeddings...")
#     mongo_posts = []
#     qdrant_points = []
    
#     # Extract texts for batch embedding
#     texts_to_embed = []
#     post_metadata = []

#     for i in range(50):
#         author = random.choice(user_docs)
#         template = post_templates[i % len(post_templates)]
#         post_uuid = str(uuid.uuid4()) # THE SOURCE OF TRUTH ID
        
#         created_at = datetime.utcnow() - timedelta(days=random.randint(0, 30))
#         full_title = f"{template['title']} #{i}"
        
#         # Data for Mongo
#         mongo_posts.append({
#             "uuid": post_uuid,
#             "title": full_title,
#             "description": template['description'],
#             "author": author["_id"],
#             "authorName": author["name"],
#             "authorAvatar": author["avatarUrl"],
#             "isPublic": True,
#             "images": [random.choice(image_pool)],
#             "hashtags": ["tech", "engineering"],
#             "createdAt": created_at
#         })

#         # Prep for Qdrant
#         texts_to_embed.append(f"{full_title}. {template['description']}")
#         post_metadata.append({"uuid": post_uuid, "title": full_title, "description": template['description']})

#     # 4. Batch Embedding (FastEmbed is great at this)
#     embeddings = list(embed_model.embed(texts_to_embed))

#     for i, vector in enumerate(embeddings):
#         qdrant_points.append(
#             PointStruct(
#                 id=post_metadata[i]["uuid"], # Synchronized ID
#                 vector=vector.tolist(),
#                 payload=post_metadata[i]
#             )
#         )

#     # 5. Execute Dual-Write
#     print("3.Finalizing Dual-Write...")
#     db.posts.insert_many(mongo_posts)
#     qdrant_client.upsert(collection_name=COLLECTION_NAME, points=qdrant_points)

#     print(f"✅ Success! Seeded {len(user_docs)} Users and 50 Posts (Synchronized).")

# if __name__ == "__main__":
#     run_seeder()