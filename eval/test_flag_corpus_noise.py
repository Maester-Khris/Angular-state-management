from flag_corpus_noise import flag_docs


def _doc(uuid, title, author):
    return {"uuid": uuid, "title": title, "authorName": author}


def test_high_volume_templated_author_is_flagged():
    records = [_doc(f"u{i}", f"Revolutionizing Customer Experience with Tool {i}", "Sista AI") for i in range(25)]
    flagged = flag_docs(records, min_author_posts=20, title_similarity_threshold=0.6)
    assert set(f"u{i}" for i in range(25)) <= flagged


def test_high_volume_but_topically_diverse_author_is_not_flagged():
    titles = [
        "Postgres index tuning for large tables", "React state management with signals",
        "Kubernetes rollback strategies", "Redis caching for read-heavy APIs",
        "Async Python event loops explained", "Building a CLI with argparse",
        "gRPC vs REST for internal services", "Terraform modules for multi-region",
        "Debugging memory leaks in Node", "GraphQL schema stitching basics",
        "WebAssembly for image processing", "Rust ownership for beginners",
        "CI/CD pipelines with GitHub Actions", "Observability with OpenTelemetry",
        "Feature flags done right", "Database migrations without downtime",
        "Testing React hooks with Vitest", "gRPC streaming patterns",
        "Event sourcing vs CRUD", "Rate limiting strategies for public APIs",
        "Zero-downtime blue-green deploys",
    ]
    records = [_doc(f"u{i}", t, "Prolific Engineer") for i, t in enumerate(titles)]
    flagged = flag_docs(records, min_author_posts=20, title_similarity_threshold=0.6)
    assert not (set(f"u{i}" for i in range(len(titles))) & flagged)


def test_low_volume_author_with_distinct_titles_is_not_flagged():
    titles = ["Learning Rust in a weekend", "My first Kubernetes cluster", "Notes on SQL indexing",
              "Why I switched to Neovim", "A week with Zig"]
    records = [_doc(f"u{i}", t, "Diary Writer") for i, t in enumerate(titles)]
    assert flag_docs(records, min_author_posts=20) == set()


def test_near_duplicate_titles_across_different_authors_are_flagged():
    records = [
        _doc("a", "Revolutionizing Customer Experience with AI Voice Assistants", "Author A"),
        _doc("b", "Revolutionizing Customer Service with AI Voice Assistants", "Author B"),
    ] + [_doc(f"filler{i}", f"Unrelated topic number {i} about databases", "Filler Author") for i in range(20)]
    flagged = flag_docs(records, min_author_posts=20, title_similarity_threshold=0.6)
    assert {"a", "b"} <= flagged
