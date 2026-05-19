
import os
import json
import uuid
import bcrypt
import random
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient
from groq import Groq
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MONGO_URI = (
    f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}"
    f"@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
)
QDRANT_URL      = os.getenv("QDRANT_URL")
QDRANT_API_KEY  = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME")
GROQ_API_KEY    = os.getenv("GROQ_API_KEY")

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
    data = json.load(f)
    image_pool = data['wallpapers']

with open("seed.json") as f:
    seed_data = json.load(f)

users_base     = seed_data["usersBase"]
post_templates = seed_data["postTemplates"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text


def unique_slug(base_slug: str, seen: set) -> str:
    slug = base_slug
    counter = 1
    while slug in seen:
        slug = f"{base_slug}-{counter}"
        counter += 1
    seen.add(slug)
    return slug


def estimate_read_time(text: str) -> int:
    words = len(text.split())
    return max(1, round(words / 200))


def skewed_date(max_days: int = 60) -> datetime:
    fraction = random.random() ** 2
    days_ago = int(fraction * max_days)
    hours_ago = random.randint(0, 23)
    return datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)


def pick_images(pool: list, avg: int = 2, max_count: int = 4) -> list:
    weights = [1, avg, avg - 1, 1]
    count = random.choices(range(1, max_count + 1), weights=weights)[0]
    return random.sample(pool, min(count, len(pool)))


def get_embedding(groq_client: Groq, text: str) -> list[float]:
    """Vectorize a single text via Groq nomic-embed-text-v1_5."""
    response = groq_client.embeddings.create(
        model="nomic-embed-text-v1_5",
        input=text
    )
    return response.data[0].embedding


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

def run_seeder():
    # 1. Init clients
    mongo_client = MongoClient(MONGO_URI)
    db           = mongo_client.get_database()
    qdrant       = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    groq_client  = Groq(api_key=GROQ_API_KEY)

    # ------------------------------------------------------------------
    # 2. Wipe ALL existing data
    # ------------------------------------------------------------------
    print("Dropping all MongoDB collections...")
    for name in db.list_collection_names():
        db.drop_collection(name)
        print(f"   dropped collection: {name}")

    print("Recreating Qdrant collection...")
    qdrant.recreate_collection(
        collection_name=COLLECTION_NAME,
        # nomic-embed-text-v1_5 outputs 768-dim vectors
        vectors_config=VectorParams(size=768, distance=Distance.COSINE),
    )

    # ------------------------------------------------------------------
    # 3. Seed users
    # ------------------------------------------------------------------
    print("\nSeeding users...")
    salt      = bcrypt.gensalt(rounds=10)
    hashed_pw = bcrypt.hashpw(b"password123", salt).decode()
    user_docs = []

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

    print(f"   {len(user_docs)} users inserted")

    # ------------------------------------------------------------------
    # 4. Build posts
    # ------------------------------------------------------------------
    print("\nPreparing posts and generating embeddings...")

    seen_slugs    = set()
    mongo_posts   = []
    qdrant_points = []

    for template in post_templates:
        author    = random.choice(user_docs)
        post_uuid = str(uuid.uuid4())
        hashtags  = random.sample(HASHTAG_POOL, k=random.randint(1, 2))
        images    = pick_images(image_pool)
        created   = skewed_date(max_days=60)

        base_slug = slugify(template["title"])
        slug      = unique_slug(base_slug, seen_slugs)
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
            "readTime":     read_time,
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

        print(f"   embedding: {template['title'][:50]}...")
        vector = get_embedding(groq_client, embed_text)

        qdrant_points.append(
            PointStruct(
                id      = post_uuid,
                vector  = vector,
                payload = {
                    "uuid":        post_uuid,
                    "slug":        slug,
                    "title":       template["title"],
                    "description": template["description"],
                    "hashtags":    hashtags,
                },
            )
        )

    # ------------------------------------------------------------------
    # 5. Dual-write
    # ------------------------------------------------------------------
    print("\nWriting to MongoDB...")
    db.posts.insert_many(mongo_posts)

    print("Upserting to Qdrant...")
    qdrant.upsert(collection_name=COLLECTION_NAME, points=qdrant_points)

    print(
        f"\nDone — {len(user_docs)} users · {len(mongo_posts)} posts · "
        f"{len(qdrant_points)} vectors synchronized."
    )


if __name__ == "__main__":
    run_seeder()

# import os
# import json
# import uuid
# import bcrypt
# import random
# import re
# from datetime import datetime, timedelta
# from dotenv import load_dotenv
# from pymongo import MongoClient
# from qdrant_client import QdrantClient
# from qdrant_client.models import PointStruct, VectorParams, Distance
# from fastembed import TextEmbedding

# load_dotenv()

# # ---------------------------------------------------------------------------
# # Configuration
# # ---------------------------------------------------------------------------
# MONGO_URI = (
#     f"mongodb+srv://{os.getenv('MONGO_USERNAME')}:{os.getenv('MONGO_PASSWORD')}"
#     f"@cluster0.sgdzstx.mongodb.net/{os.getenv('MONGO_DATABASE')}?appName=Cluster0"
# )
# QDRANT_URL        = os.getenv("QDRANT_URL")
# QDRANT_API_KEY    = os.getenv("QDRANT_API_KEY")
# COLLECTION_NAME   = os.getenv("QDRANT_COLLECTION_NAME")

# # ---------------------------------------------------------------------------
# # Domain-relevant hashtag pool — randomly assigned (1–2 per post)
# # ---------------------------------------------------------------------------
# HASHTAG_POOL = [
#     "webdev", "frontend", "backend", "fullstack", "javascript", "typescript",
#     "nodejs", "react", "css", "api", "devops", "docker", "kubernetes", "cicd",
#     "cloud", "aws", "azure", "serverless", "terraform", "microservices",
#     "ai", "llm", "machinelearning", "rag", "promptengineering", "openai",
#     "data", "postgresql", "redis", "spark", "dbt", "airflow", "dataops",
#     "cybersecurity", "performance", "testing", "observability", "oss",
# ]

# # ---------------------------------------------------------------------------
# # Load seed data
# # ---------------------------------------------------------------------------
# with open("images.json") as f:
#     data = json.load(f)          # flat list of image URLs
#     image_pool = data['wallpapers']

# with open("seed.json") as f:
#     seed_data = json.load(f)

# users_base     = seed_data["usersBase"]
# post_templates = seed_data["postTemplates"]

# # ---------------------------------------------------------------------------
# # Helpers
# # ---------------------------------------------------------------------------

# def slugify(text: str) -> str:
#     """Convert a title to a URL-safe slug."""
#     text = text.lower().strip()
#     text = re.sub(r"[^\w\s-]", "", text)
#     text = re.sub(r"[\s_]+", "-", text)
#     text = re.sub(r"-+", "-", text)
#     return text


# def unique_slug(base_slug: str, seen: set) -> str:
#     """Append a numeric suffix when a slug has already been used."""
#     slug = base_slug
#     counter = 1
#     while slug in seen:
#         slug = f"{base_slug}-{counter}"
#         counter += 1
#     seen.add(slug)
#     return slug


# def estimate_read_time(text: str) -> int:
#     """Estimate reading time in minutes (avg 200 wpm)."""
#     words = len(text.split())
#     return max(1, round(words / 200))


# def skewed_date(max_days: int = 60) -> datetime:
#     """
#     Return a random past datetime skewed toward recent dates.
#     Uses a square-root distribution so recent posts are denser.
#     """
#     fraction = random.random() ** 2          # squaring skews toward 0 (recent)
#     days_ago = int(fraction * max_days)
#     hours_ago = random.randint(0, 23)
#     return datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)


# def pick_images(pool: list, avg: int = 2, max_count: int = 4) -> list:
#     """Return 1–max_count images, distributed around avg."""
#     weights = [1, avg, avg - 1, 1]          # 1 img, 2 imgs, 3 imgs, 4 imgs
#     count = random.choices(range(1, max_count + 1), weights=weights)[0]
#     return random.sample(pool, min(count, len(pool)))


# # ---------------------------------------------------------------------------
# # Seeder
# # ---------------------------------------------------------------------------

# def run_seeder():
#     # 1. Init clients
#     mongo_client = MongoClient(MONGO_URI)
#     db           = mongo_client.get_database()
#     qdrant       = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
#     embed_model  = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

#     # ------------------------------------------------------------------
#     # 2. Wipe ALL existing data
#     # ------------------------------------------------------------------
#     print("🧹 Dropping all MongoDB collections...")
#     for name in db.list_collection_names():
#         db.drop_collection(name)
#         print(f"   ✗ dropped collection: {name}")

#     print("🧹 Recreating Qdrant collection...")
#     qdrant.recreate_collection(
#         collection_name=COLLECTION_NAME,
#         vectors_config=VectorParams(size=384, distance=Distance.COSINE),
#     )

#     # ------------------------------------------------------------------
#     # 3. Seed users
#     # ------------------------------------------------------------------
#     print("\n👤 Seeding users...")
#     salt       = bcrypt.gensalt(rounds=10)
#     hashed_pw  = bcrypt.hashpw(b"password123", salt).decode()
#     user_docs  = []

#     for u in users_base:
#         doc = {
#             **u,
#             "useruuid":  str(uuid.uuid4()),
#             "password":  hashed_pw,
#             "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed={u['name']}",
#             "status":    "active",
#             "createdAt": skewed_date(max_days=180),
#         }
#         result = db.users.insert_one(doc)
#         doc["_id"] = result.inserted_id
#         user_docs.append(doc)

#     print(f"   ✓ {len(user_docs)} users inserted")

#     # ------------------------------------------------------------------
#     # 4. Build posts
#     # ------------------------------------------------------------------
#     print("\n📝 Preparing 50 posts and generating embeddings...")

#     seen_slugs   = set()
#     mongo_posts  = []
#     qdrant_points = []
#     texts_to_embed = []
#     post_meta    = []

#     for i, template in enumerate(post_templates):
#         author    = random.choice(user_docs)
#         post_uuid = str(uuid.uuid4())
#         hashtags  = random.sample(HASHTAG_POOL, k=random.randint(1, 2))
#         images    = pick_images(image_pool)
#         created   = skewed_date(max_days=60)

#         # Slug: derived from title, guaranteed unique
#         base_slug = slugify(template["title"])
#         slug      = unique_slug(base_slug, seen_slugs)

#         # Read time based on description
#         read_time = estimate_read_time(template["description"])

#         mongo_posts.append({
#             "uuid":         post_uuid,
#             "slug":         slug,
#             "title":        template["title"],
#             "description":  template["description"],
#             "author":       author["_id"],
#             "authorName":   author["name"],
#             "authorAvatar": author["avatarUrl"],
#             "status":       "published",
#             "isPublic":     True,
#             "images":       images,
#             "hashtags":     hashtags,
#             "readTime":     read_time,          # minutes
#             "likes":        random.randint(0, 340),
#             "views":        random.randint(10, 4800),
#             "createdAt":    created,
#             "updatedAt":    created,
#         })

#         # Embed: title + description + hashtags for rich semantic context
#         embed_text = (
#             f"{template['title']}. "
#             f"{template['description']} "
#             f"#{' #'.join(hashtags)}"
#         )
#         texts_to_embed.append(embed_text)
#         post_meta.append({
#             "uuid":        post_uuid,
#             "slug":        slug,
#             "title":       template["title"],
#             "description": template["description"],
#             "hashtags":    hashtags,
#         })

#     # ------------------------------------------------------------------
#     # 5. Batch embed
#     # ------------------------------------------------------------------
#     print("   ⚙️  Generating embeddings (batch)...")
#     embeddings = list(embed_model.embed(texts_to_embed))

#     for i, vector in enumerate(embeddings):
#         qdrant_points.append(
#             PointStruct(
#                 id      = post_meta[i]["uuid"],
#                 vector  = vector.tolist(),
#                 payload = post_meta[i],         # uuid, slug, title, description, hashtags
#             )
#         )

#     # ------------------------------------------------------------------
#     # 6. Dual-write
#     # ------------------------------------------------------------------
#     print("   💾 Writing to MongoDB...")
#     db.posts.insert_many(mongo_posts)

#     print("   💾 Upserting to Qdrant...")
#     qdrant.upsert(collection_name=COLLECTION_NAME, points=qdrant_points)

#     print(
#         f"\n✅ Done — {len(user_docs)} users · {len(mongo_posts)} posts · "
#         f"{len(qdrant_points)} vectors synchronized."
#     )


# if __name__ == "__main__":
#     run_seeder()

