# data-utils/eval/rrf_fusion.py
# Faithful Python port of node-backend/services/rankprocessor.js's mergeResults, plus the
# hydration-filter step node-backend/routing/home.js:146-159 runs before calling it. Kept as
# two separate functions because they're two separate responsibilities in two separate
# production files -- home.js's route never calls mergeResults with the full, unfiltered
# semantic result list.


def filter_missing_from_lexical(semantic_results: list[dict], keyword_results: list[dict]) -> list[dict]:
    """Port of home.js:146-151. Only the semantic matches NOT already present in the lexical
    result set are kept, in their original relative order -- this filtered (and effectively
    re-indexed) list is what production passes as mergeResults' second argument, never the
    full semantic ranking."""
    lexical_uuids = {item["uuid"] for item in keyword_results}
    return [item for item in semantic_results if item["uuid"] not in lexical_uuids]


def merge_results(keyword_results: list[dict], semantic_results: list[dict], k: int = 60, semantic_weight: float = 1.2) -> list[dict]:
    """Line-for-line port of rankprocessor.js's mergeResults. RRF score per item:
    (1 / (k + rank)) * weight, rank is the 1-indexed position in whichever input list the
    item came from, weights summed across lists if an item appears in both. Ties on uuid use
    last-occurrence-wins for the stored item payload, mirroring JS's
    `new Map(allItems.map(item => [item.uuid, item])).values()` semantics (semantic_results
    is concatenated after keyword_results, so a semantic duplicate wins the payload)."""
    scores: dict[str, float] = {}

    def update_score(items: list[dict], weight: float) -> None:
        for index, item in enumerate(items):
            uid = item["uuid"]
            rank_score = (1 / (k + (index + 1))) * weight
            scores[uid] = scores.get(uid, 0.0) + rank_score

    update_score(keyword_results, 1.0)
    update_score(semantic_results, semantic_weight)

    unique_items: dict[str, dict] = {}
    for item in keyword_results + semantic_results:
        unique_items[item["uuid"]] = item  # last occurrence wins, matches JS Map semantics

    mapped = [{**item, "combinedScore": scores[item["uuid"]]} for item in unique_items.values()]
    mapped.sort(key=lambda x: x["combinedScore"], reverse=True)

    if not mapped:
        return []

    max_score = mapped[0]["combinedScore"]
    min_score = mapped[-1]["combinedScore"]

    result = []
    for item in mapped:
        percentage = 100.0 if max_score == min_score else (item["combinedScore"] / max_score) * 100
        new_item = {field: value for field, value in item.items() if field != "combinedScore"}
        new_item["matchPercentage"] = round(percentage)
        result.append(new_item)
    return result
