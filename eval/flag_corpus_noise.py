# eval/flag_corpus_noise.py
# Usage: python flag_corpus_noise.py [--corpus devto_corpus.jsonl] [--out _pipeline_v2/flagged_uuids.json]
#
# One-time script: flags corpus docs that look like templated marketing/spam/diary content --
# high-volume authors (>= min_author_posts) whose titles cluster by near-duplicate similarity --
# plus near-duplicate titles across any two docs regardless of author. Flagged docs are NOT
# removed from the corpus/retrieval index (they stay searchable, functioning as realistic
# noise); callers exclude them from query-seed sampling and from ever being labeled relevant.

import argparse
import json
import os
from collections import defaultdict
from difflib import SequenceMatcher

from _pipeline_log import log_stage

DEFAULT_CORPUS = os.path.join(os.path.dirname(__file__), "devto_corpus.jsonl")


def _title_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _block_key(title: str) -> str:
    """Cheap blocking key so near-dup comparison only runs within same-key buckets --
    O(n^2) SequenceMatcher over the full corpus (30k docs) is 900M pairs, infeasible.
    Near-duplicate titles usually share their opening words (templated headlines, syndicated
    posts), so the sorted first 2 words is a reasonable (if imperfect -- misses duplicates that
    only diverge at the very start) bucket key."""
    words = title.lower().split()
    return " ".join(sorted(words[:2]))


def flag_docs(records: list[dict], min_author_posts: int = 20, title_similarity_threshold: float = 0.6) -> set[str]:
    flagged: set[str] = set()

    by_author: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        by_author[rec.get("authorName", "")].append(rec)

    for author, docs in by_author.items():
        if len(docs) < min_author_posts:
            continue
        for i in range(len(docs)):
            close_matches = sum(
                1 for j in range(len(docs))
                if i != j and _title_similarity(docs[i]["title"], docs[j]["title"]) >= title_similarity_threshold
            )
            if close_matches >= 2:  # at least 2 other posts near-match this one's title
                flagged.add(docs[i]["uuid"])

    blocks: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        blocks[_block_key(rec["title"])].append(rec)

    for bucket in blocks.values():
        if len(bucket) < 2:
            continue
        for i in range(len(bucket)):
            for j in range(i + 1, len(bucket)):
                if _title_similarity(bucket[i]["title"], bucket[j]["title"]) >= title_similarity_threshold:
                    flagged.add(bucket[i]["uuid"])
                    flagged.add(bucket[j]["uuid"])

    return flagged


def load_corpus(path: str) -> list[dict]:
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rec = json.loads(line)
                records.append({"uuid": rec["uuid"], "title": rec["title"], "authorName": rec.get("authorName", "")})
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Flag templated/spam/near-duplicate corpus docs.")
    parser.add_argument("--corpus", default=DEFAULT_CORPUS)
    parser.add_argument("--min-author-posts", type=int, default=20)
    parser.add_argument("--title-similarity-threshold", type=float, default=0.7)  # 0.6 flagged 20.2% of corpus (too aggressive); 0.7 flagged 9.1%, matching the audit's ~7.7%-from-high-volume-accounts estimate
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "flagged_uuids.json"))
    args = parser.parse_args()

    records = load_corpus(args.corpus)
    print(f"Loaded {len(records)} corpus docs.")

    flagged = flag_docs(records, args.min_author_posts, args.title_similarity_threshold)
    print(f"Flagged {len(flagged)} docs ({len(flagged) / len(records):.1%} of corpus).")

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sorted(flagged), f, indent=2)
    print(f"Saved flagged uuids to {out_path}")
    log_stage("flag_corpus_noise", input_count=len(records), output_count=len(flagged), errors=0)
