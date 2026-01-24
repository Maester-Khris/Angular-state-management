// services/rankProcessor.js

const mergeResults = (keywordResults, semanticResults) => {
  const k = 60; // RRF constant to smooth out high-ranking bias
  const semanticWeight = 1.2; // 20% boost for semantic matches
  const scores = new Map();

  // Helper to update RRF score
  const updateScore = (items, weight = 1.0) => {
    items.forEach((item, index) => {
      const id = item.uuid;
      const currentScore = scores.get(id) || 0;
      // RRF Formula: 1 / (k + rank)
      const rankScore = (1 / (k + (index + 1))) * weight;
      scores.set(id, currentScore + rankScore);
    });
  };

  updateScore(keywordResults, 1.0);
  updateScore(semanticResults, semanticWeight);

  // Combine unique items from both lists
  const allItems = [...keywordResults, ...semanticResults];
  const uniqueItems = Array.from(new Map(allItems.map(item => [item.uuid, item])).values());

  const mappedResults = uniqueItems.map(item => ({
    ...item,
    combinedScore: scores.get(item.uuid)
  })).sort((a, b) => b.combinedScore - a.combinedScore);

  // --- Normalization Logic ---
  if (mappedResults.length === 0) return [];

  const maxScore = mappedResults[0].combinedScore;
  const minScore = mappedResults[mappedResults.length - 1].combinedScore;

  return mappedResults.map(item => {
    // Calculate percentage relative to the best result
    // If only one result, match is 100%
    const percentage = maxScore === minScore ? 100 : ((item.combinedScore / maxScore) * 100);
    return {
      ...item,
      matchPercentage: Math.round(percentage),
      // Clean up internal scores before sending to Angular
      combinedScore: undefined 
    };
  });

  // // Final Sort based on calculated RRF score
  // return uniqueItems
  //   .map(item => ({
  //     ...item,
  //     combinedScore: scores.get(item.uuid)
  //   }))
  //   .sort((a, b) => b.combinedScore - a.combinedScore);
};

module.exports = { mergeResults };