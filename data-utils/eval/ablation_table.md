# Hybrid search eval -- ablation table (36 golden queries)

| Metric | Mongo $text | BM25 baseline | Qdrant semantic | RRF hybrid |
|---|---|---|---|---|
| Precision@5 | 0.2444 | 0.2944 | 0.3333 | 0.1556 |
| Recall@5 | 0.4681 | 0.6394 | 0.6889 | 0.2931 |
| nDCG@10 | 0.5500 | 0.6908 | 0.7670 | 0.4663 |
