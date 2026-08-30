from split_dev_eval import stratified_split


def test_split_preserves_type_proportions():
    queries = (
        [{"query": f"d{i}", "relevant_uuids": []} for i in range(20)]
        + [{"query": f"b{i}", "relevant_uuids": []} for i in range(10)]
    )
    types = {f"d{i}": "doc2query" for i in range(20)} | {f"b{i}": "broad" for i in range(10)}

    dev, ev = stratified_split(queries, types, dev_fraction=0.2, seed=1)

    dev_types = [types[q["query"]] for q in dev]
    assert dev_types.count("doc2query") == 4  # 20% of 20
    assert dev_types.count("broad") == 2       # 20% of 10
    assert len(dev) + len(ev) == 30


def test_split_is_disjoint_and_covers_all_queries():
    queries = [{"query": f"q{i}", "relevant_uuids": []} for i in range(10)]
    types = {f"q{i}": "broad" for i in range(10)}
    dev, ev = stratified_split(queries, types, dev_fraction=0.3, seed=1)
    dev_names = {q["query"] for q in dev}
    ev_names = {q["query"] for q in ev}
    assert dev_names.isdisjoint(ev_names)
    assert dev_names | ev_names == {f"q{i}" for i in range(10)}


def test_split_is_deterministic_given_seed():
    queries = [{"query": f"q{i}", "relevant_uuids": []} for i in range(10)]
    types = {f"q{i}": "broad" for i in range(10)}
    dev1, _ = stratified_split(queries, types, dev_fraction=0.3, seed=5)
    dev2, _ = stratified_split(queries, types, dev_fraction=0.3, seed=5)
    assert [q["query"] for q in dev1] == [q["query"] for q in dev2]
