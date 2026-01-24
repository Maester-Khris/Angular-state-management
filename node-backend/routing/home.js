const router = require('express').Router();
const dbCrudOperator = require('../database/crud');
const MongoConnection = require('../database/connection');
const { getSemanticMatches, checkPythonStatus } = require('../services/remotesearch');
const { mergeResults } = require('../services/rankprocessor');
const Post = require('../database/models/post');

router.get("/health", async (req, res) => {
    const start = Date.now();
    
    // Map Mongoose readyState numbers to readable strings
    const dbStates = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };

    const pythonStatus = await checkPythonStatus();
    const dbStatus = dbStates[MongoConnection.getDbStatus()] || "unknown";
    const isSystemHealthy = (pythonStatus === "connected" && dbStatus === "connected");

    res.status(isSystemHealthy ? 200 : 503).json({
        status: isSystemHealthy ? "UP" : "DEGRADED",
        timestamp: new Date(),
        latency: `${Date.now() - start}ms`,
        services: {
            database: {
                name: "MongoDB Atlas",
                status: dbStatus
            },
            semantic_engine: {
                name: "Python Flask / Qdrant",
                status: pythonStatus,
                endpoint: "http://localhost:5000"
            }
        }
    });
});


router.get('/api/feed', async (req, res) => {
  try {
    const { cursor, limit } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 10, 50);
    const feedResponse = await dbCrudOperator.getHomeFeed(cursor, pageLimit);
    
    // Return JSON for the Infinite Scroll component
    return res.status(200).json(feedResponse);
  } catch (error) {
    console.error("Feed error:", error);
    return res.status(500).json({ message: "Error fetching feed" });
  }
});

// hybrid search= lexical text + semantic
router.get('/api/search', async (req, res) => {
  try {
    const { q, limit, mode = 'hybrid' } = req.query;
    if (!q) return res.status(400).json({ message: "Search term 'q' is required" });
    
    const searchLimit = Math.min(parseInt(limit) || 20, 50);

    if (mode === 'lexical') {
      const results = await dbCrudOperator.searchPostsByKeyword(q, searchLimit);
      // Map to same structure for Angular consistency
      const unifiedResults = results.map(r => ({ ...r, matchPercentage: 100 }));
      return res.status(200).json({ query: q, mode, count: unifiedResults.length, results: unifiedResults });
    }

    // --- Hybrid Mode (Default) ----
    // Parallel Execution: If one fails, the other still succeeds
    const [mongoPromise, pythonPromise] = await Promise.allSettled([
      dbCrudOperator.searchPostsByKeyword(q, searchLimit),
      getSemanticMatches(q, searchLimit)
    ]);

    const keywordResults = mongoPromise.status === 'fulfilled' ? mongoPromise.value : [];
    const semanticResults = pythonPromise.status === 'fulfilled' ? pythonPromise.value : [];  
    
    // 2. Identify missing data
    // Semantic matches only have {uuid, score}. We need full objects.
    const lexicalIds = new Set(keywordResults.map(p => p.uuid));
    const missingIds = semanticResults.filter(p => !lexicalIds.has(p.uuid)).map(p => p.uuid);
    
    // 3. Hydrate missing objects from Mongo
    let hydratedSemanticDocs = [];
    if (missingIds.length > 0) {
      hydratedSemanticDocs = await Post.find({ uuid: { $in: missingIds } }).lean();
    }

    const hybridResults = mergeResults(keywordResults, hydratedSemanticDocs);

    return res.status(200).json({
      query: q,
      mode,
      count: hybridResults.length,
      results: hybridResults.slice(0, searchLimit)
    });

    // Initial Implementation: Fetching from Mongo
    // const keywordResults = await dbCrudOperator.searchPostsByKeyword(q, searchLimit);
    // return res.status(200).json({
    //   query: q,
    //   count: keywordResults.length,
    //   results: keywordResults
    // });
  } catch (error) {
    console.error("Search Route Error:", error);
    return res.status(500).json({ message: "Internal search error" });
  }
});

module.exports = router;