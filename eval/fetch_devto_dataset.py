# eval/fetch_devto_dataset.py
# Usage: python fetch_devto_dataset.py [--limit 30000] [--out devto_corpus.json] [--seed 42]
# Requires: pip install datasets  (Hugging Face `datasets` lib — not in data-utils/requirements.txt
#           until first real run confirms this works against the live dataset)
#
# One-time script: pulls the Alaamer/devto_articles HF mirror (307k rows, confirmed MIT-tagged,
# see artifacts/ai-search-upgrade/eval-corpus-dataset-research-2026-08-14.md), filters to rows
# whose `description` naturally fits the Post schema's 120-400 char band
# (node-backend/database/models/post.js), samples `--limit` rows, and shapes them into the same
# JSON shape as eval/posts.json. Retrieval + shaping only — does NOT write to Mongo/Qdrant.

import argparse
import ast
import json
import os
import random
import re
import sys
import uuid
from datetime import datetime, timedelta

try:
    from datasets import load_dataset
except ImportError:
    print("Missing dependency. Run: pip install datasets", file=sys.stderr)
    sys.exit(1)

# Schema's real minlength is 120, but dev.to's `description` field is auto-truncated to ~100
# chars by the platform unless an author sets a custom meta-description (confirmed empirically:
# 94.0% of English rows fall in [80,400] vs only 2.7% in [120,400], sharp cliff at 100->110).
# Lowered to 80 to actually reach the 30k target from a single source — this data is eval-only
# and never round-trips through Mongoose validation (raw insert_many in load_mongo_eval.py).
MIN_DESC_LEN = 80
MAX_DESC_LEN = 400

# Candidate column names per field — the HF mirror's exact schema wasn't directly inspected
# before writing this script (only confirmed via the dataset card/research pass), so resolve
# defensively and fail loudly with the real column list rather than silently reading the wrong
# field.
FIELD_CANDIDATES = {
    "title": ["title"],
    "description": ["description"],
    "tags": ["tag_list", "tags", "tag"],
    "published_at": ["published_at", "published_timestamp", "date"],
    "reading_time": ["reading_time_minutes", "reading_time"],
    "author": ["user", "user_name", "username", "author"],
    "language": ["language"],
}

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def resolve_columns(columns: list[str]) -> dict[str, str | None]:
    resolved = {}
    for field, candidates in FIELD_CANDIDATES.items():
        match = next((c for c in candidates if c in columns), None)
        resolved[field] = match
    missing_required = [f for f in ("title", "description", "language") if not resolved[f]]
    if missing_required:
        print(f"Missing required columns {missing_required}. Available columns: {columns}", file=sys.stderr)
        sys.exit(1)
    return resolved


def clean_description(raw: str) -> str:
    return _HTML_TAG_RE.sub("", raw or "").strip()


def slugify(title: str, suffix: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"{slug[:60]}-{suffix}"


def parse_hashtags(raw) -> list[str]:
    """`tag_list` in the HF mirror is a stringified Python list repr
    (e.g. "['webdev', 'astro']"), not a real list or plain CSV — same shape as `user`."""
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(t).lower().strip() for t in raw if str(t).strip()][:5]
    if isinstance(raw, str):
        try:
            parsed = ast.literal_eval(raw)
            if isinstance(parsed, list):
                return [str(t).lower().strip() for t in parsed if str(t).strip()][:5]
        except (ValueError, SyntaxError):
            pass
        return [t.strip().lower() for t in raw.split(",") if t.strip()][:5]
    return []


def parse_author_name(raw) -> str | None:
    """The HF mirror's `user` column is a stringified Python dict repr
    (e.g. "{'name': 'Jane Doe', ...}"), not JSON — needs ast.literal_eval, not json.loads."""
    if not raw:
        return None
    if isinstance(raw, dict):
        return raw.get("name")
    if isinstance(raw, str):
        try:
            parsed = ast.literal_eval(raw)
            return parsed.get("name") if isinstance(parsed, dict) else None
        except (ValueError, SyntaxError):
            return None
    return None


def random_recent_datetime(rng: random.Random) -> str:
    days_ago = rng.randint(1, 730)
    dt = datetime.now() - timedelta(days=days_ago, hours=rng.randint(0, 23))
    return dt.isoformat()


def build_record(row: dict, cols: dict, rng: random.Random) -> dict | None:
    if row.get(cols["language"]) != "en":
        return None

    title = (row.get(cols["title"]) or "").strip()
    description = clean_description(row.get(cols["description"]) or "")

    if not title or not (MIN_DESC_LEN <= len(description) <= MAX_DESC_LEN):
        return None

    record_uuid = str(uuid.uuid4())
    published_raw = row.get(cols["published_at"]) if cols["published_at"] else None
    published_at = str(published_raw) if published_raw else random_recent_datetime(rng)
    reading_time = row.get(cols["reading_time"]) if cols["reading_time"] else None
    author_name = parse_author_name(row.get(cols["author"]) if cols["author"] else None) or "Dev.to Author"

    return {
        "_id": str(uuid.uuid4()).replace("-", "")[:24],
        "uuid": record_uuid,
        "slug": slugify(title, record_uuid[:8]),
        "title": title,
        "description": description,
        "author": str(uuid.uuid4()).replace("-", "")[:24],  # placeholder ref, no real User doc
        "authorName": author_name,
        "authorAvatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={author_name}",
        "status": "published",
        "isPublic": True,
        "images": [],
        "hashtags": parse_hashtags(row.get(cols["tags"]) if cols["tags"] else None),
        "readTime": int(reading_time) if reading_time else max(1, len(description) // 200),
        "likes": 0,
        "views": 0,
        "createdAt": published_at,
        "updatedAt": published_at,
        "publishedAt": published_at,
        "_source": "devto:Alaamer/devto_articles",
    }


def main():
    parser = argparse.ArgumentParser(description="Pull a tech-domain post corpus from the Dev.to HF mirror.")
    parser.add_argument("--limit", type=int, default=30000)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "devto_corpus.jsonl"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)

    print("Loading Alaamer/devto_articles from Hugging Face...")
    ds = load_dataset("Alaamer/devto_articles", split="train")
    print(f"Loaded {len(ds)} rows. Columns: {ds.column_names}")

    cols = resolve_columns(ds.column_names)
    print(f"Resolved columns: {cols}")

    shuffled = ds.shuffle(seed=args.seed)

    records = []
    seen = set()
    for row in shuffled:
        if len(records) >= args.limit:
            break
        record = build_record(row, cols, rng)
        if record is None:
            continue
        dedup_key = (record["title"], record["description"])
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        records.append(record)

    print(f"Kept {len(records)} records (target {args.limit}) after description-length filter + dedup.")

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Saved {len(records)} posts to {out_path}")


if __name__ == "__main__":
    main()
