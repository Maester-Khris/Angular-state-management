# data-utils/eval/rrf_fusion.py
# Faithful Python port of node-backend/services/rankprocessor.js's mergeResults, plus the
# hydration/reordering step node-backend/routing/home.js runs before calling it. Kept as
# two separate functions because they're two separate responsibilities in two separate
# production files.
#
# Fixed 2026-08-21: home.js used to filter out any semantic match already present in the
# lexical results before fusion, and hydrate the rest via an unordered Mongo `$in` fetch --
# silently dropping cross-leg-consensus docs' semantic RRF contribution and scrambling the
# rank of the survivors. Root cause: systematic-debugging pass verifying the first-principles
# invariant that a leg's rank must reach fusion intact. See node-backend/tests/
# search.integration.test.js for the production-side regression test.


def build_ordered_semantic_results(semantic_results: list[dict], keyword_results: list[dict]) -> list[dict]:
    """Port of home.js's fixed hydration/reordering logic. Rebuilds the semantic leg in its
    own original rank order (never re-derived from an unordered hydration fetch), substituting
    full lexical-leg doc data for any uuid the lexical leg also found instead of dropping it --
    so cross-leg agreement still earns both legs' RRF contribution."""
    keyword_by_uuid = {item["uuid"]: item for item in keyword_results}
    return [keyword_by_uuid.get(item["uuid"], item) for item in semantic_results]


def merge_results(keyword_results: list[dict], semantic_results: list[dict], k: int = 60, lexical_weight: float = 1.0, semantic_weight: float = 0.8) -> list[dict]:
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

    update_score(keyword_results, lexical_weight)
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
