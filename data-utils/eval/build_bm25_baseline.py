# data-utils/eval/build_bm25_baseline.py
# Usage: python build_bm25_baseline.py [--corpus ../../eval/devto_corpus.jsonl]
#        [--queries ../../eval/golden_queries_30k.json] [--out report.json]
#
# Independent BM25 baseline (classic Okapi BM25 via bm25s==0.3.10, method="robertson") over
# the same 30k-doc corpus used to seed postair_eval.posts (eval/devto_corpus.jsonl -- the
# confirmed source-of-truth file, see docs/superpowers/plans/2026-08-14-eval-infra-setup.md
# Task 2). Corpus text = title + " " + description, matching what
# node-backend/database/models/post.js:55 indexes for Mongo's $text (the lexical leg this
# baseline is compared against, not fused with). Parameters (k1=1.5, b=0.75 -- inside
# Robertson & Zaragoza's own cited default range; English stopwords; no stemming) are stated
# explicitly rather than left as silent library defaults, per the research doc's caution
# about a "fair baseline" comparison. One-time index build, reused across all 36 queries. No
# live Mongo/Qdrant/node-backend dependency -- fully standalone.

import argparse
import json
import os
import sys

import bm25s

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics import mrr, ndcg_at_k, precision_at_k, r_precision, recall_at_k

FETCH_LIMIT = 10
K_PRECISION_RECALL = 5
K_NDCG = 10

DEFAULT_CORPUS = os.path.join(os.path.dirname(__file__), "..", "..", "eval", "devto_corpus.jsonl")


def load_corpus(path: str) -> tuple[list[str], list[str]]:
    """Returns (uuids, texts) in matching positional order."""
    uuids, texts = [], []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            uuids.append(rec["uuid"])
            texts.append(f"{rec['title']} {rec['description']}")
    return uuids, texts


def load_queries(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def build_index(texts: list[str]) -> bm25s.BM25:
    corpus_tokens = bm25s.tokenize(texts, stopwords="en")
    retriever = bm25s.BM25(method="robertson", k1=1.5, b=0.75)
    retriever.index(corpus_tokens)
    return retriever


def run(corpus_path: str, queries: list[dict]) -> dict:
    uuids, texts = load_corpus(corpus_path)
    retriever = build_index(texts)

    results = []
    for entry in queries:
        query = entry["query"]
        relevant = set(entry.get("relevant_uuids", []))
        relevance = {k: int(v) for k, v in entry.get("relevance", {}).items()}

        query_tokens = bm25s.tokenize([query], stopwords="en")
        doc_indices, _scores = retriever.retrieve(query_tokens, k=FETCH_LIMIT)
        retrieved = [uuids[i] for i in doc_indices[0]]

        results.append({
            "query": query,
            "retrieved": retrieved,
            "precision_at_5": precision_at_k(retrieved, relevant, K_PRECISION_RECALL),
            "recall_at_5": recall_at_k(retrieved, relevant, K_PRECISION_RECALL),
            "ndcg_at_10": ndcg_at_k(retrieved, relevance, K_NDCG),
            "mrr": mrr(retrieved, relevant),
            "r_precision": r_precision(retrieved, relevant),
        })

    summary = {
        "total_queries": len(results),
        "avg_precision_at_5": round(sum(r["precision_at_5"] for r in results) / len(results), 4),
        "avg_recall_at_5": round(sum(r["recall_at_5"] for r in results) / len(results), 4),
        "avg_ndcg_at_10": round(sum(r["ndcg_at_10"] for r in results) / len(results), 4),
        "avg_mrr": round(sum(r["mrr"] for r in results) / len(results), 4),
        "avg_r_precision": round(sum(r["r_precision"] for r in results) / len(results), 4),
    }
    return {"summary": summary, "results": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score a from-scratch BM25 baseline (bm25s) against the v2 golden set.")
    parser.add_argument("--corpus", default=DEFAULT_CORPUS)
    parser.add_argument("--split", choices=["dev", "eval"], help="Use eval/golden_queries_v2_<split>.json")
    parser.add_argument("--queries", default=None, help="Explicit query file path (overrides --split; for ad-hoc checks only)")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    if not args.queries:
        if not args.split:
            print("ERROR: pass --split dev|eval, or --queries for an explicit ad-hoc override.", file=sys.stderr)
            sys.exit(1)
        args.queries = os.path.join(os.path.dirname(__file__), "..", "..", "eval", f"golden_queries_v2_{args.split}.json")

    report = run(args.corpus, load_queries(args.queries))
    output = json.dumps(report, indent=2)

    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Report written to {args.out}")
    print(json.dumps(report["summary"], indent=2))
