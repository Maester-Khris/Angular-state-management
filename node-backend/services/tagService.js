const crud = require('../database/crud');

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 },
    (_, i) => Array.from({ length: b.length + 1 },
      (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

async function searchTags(query, topN = 5) {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];

  const candidates = await crud.searchTagsByPrefix(q, 20);

  const scored = candidates.map(tag => ({
    name: tag.name,
    score: levenshtein(q, tag.name)
  }));
  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, topN).map(t => t.name);
}

async function syncPostTags(tags) {
  if (!tags?.length) return;
  return crud.upsertTags(tags);
}

async function getAllTags() {
  const tags = await crud.getAllTags();
  return tags.map(t => t.name);
}

module.exports = { searchTags, syncPostTags, getAllTags };
