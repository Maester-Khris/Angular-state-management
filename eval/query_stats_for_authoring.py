# eval/query_stats_for_authoring.py
# Usage: python query_stats_for_authoring.py [--corpus devto_corpus.jsonl] [--flagged _pipeline_v2/flagged_uuids.json]
#
# One-time script: surfaces two kinds of authoring aid for hand-crafted queries -- (1) hashtags
# with a high doc count (candidates for broad/multi-answer queries, where several correct
# answers should exist) and (2) title bigrams that appear in very few docs (candidates for
# hard-negative/narrow queries, where a good ranker should find little or nothing). Output is
# reference material for a human/LLM authoring pass, not the queries themselves.

import argparse
import json
import os
import re
from collections import defaultdict

from _pipeline_log import log_stage

DEFAULT_CORPUS = os.path.join(os.path.dirname(__file__), "devto_corpus.jsonl")
_WORD_RE = re.compile(r"[a-z0-9]+")


def _bigrams(title: str) -> list[str]:
    words = _WORD_RE.findall(title.lower())
    return [f"{words[i]} {words[i + 1]}" for i in range(len(words) - 1)]


def broad_topic_candidates(records: list[dict], flagged: set[str], min_docs: int = 40) -> list[dict]:
    by_hashtag: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        if rec["uuid"] in flagged:
            continue
        for tag in rec.get("hashtags", []):
            by_hashtag[tag].append(rec)

    return [
        {"hashtag": tag, "doc_count": len(docs), "sample_titles": [d["title"] for d in docs[:5]]}
        for tag, docs in sorted(by_hashtag.items(), key=lambda kv: -len(kv[1]))
        if len(docs) >= min_docs
    ]


def sparse_topic_candidates(records: list[dict], flagged: set[str], max_docs: int = 2) -> list[dict]:
    by_bigram: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        if rec["uuid"] in flagged:
            continue
        for bg in set(_bigrams(rec["title"])):
            by_bigram[bg].append(rec)

    return [
        {"bigram": bg, "doc_count": len(docs), "sample_titles": [d["title"] for d in docs]}
        for bg, docs in by_bigram.items()
        if 0 < len(docs) <= max_docs
    ]


def load_corpus(path: str) -> list[dict]:
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rec = json.loads(line)
                records.append({"uuid": rec["uuid"], "title": rec["title"], "hashtags": rec.get("hashtags", [])})
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Surface broad-topic and sparse-topic candidates for hand-authoring queries.")
    parser.add_argument("--corpus", default=DEFAULT_CORPUS)
    parser.add_argument("--flagged", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "flagged_uuids.json"))
    parser.add_argument("--min-broad-docs", type=int, default=40)
    parser.add_argument("--max-sparse-docs", type=int, default=2)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "_pipeline_v2", "query_authoring_stats.json"))
    args = parser.parse_args()

    records = load_corpus(args.corpus)
    with open(args.flagged) as f:
        flagged = set(json.load(f))

    broad = broad_topic_candidates(records, flagged, args.min_broad_docs)
    sparse = sparse_topic_candidates(records, flagged, args.max_sparse_docs)
    print(f"Found {len(broad)} broad-topic candidates, {len(sparse)} sparse-topic candidates.")

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"broad_topics": broad, "sparse_topics": sparse}, f, indent=2, ensure_ascii=False)
    print(f"Saved to {out_path}")
    log_stage("query_stats_for_authoring", input_count=len(records), output_count=len(broad) + len(sparse), errors=0)
