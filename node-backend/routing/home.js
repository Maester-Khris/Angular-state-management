const router = require('express').Router();
const dbCrudOperator = require('../database/crud');
const MongoConnection = require('../database/connection');
const Post = require('../database/models/post');
const { getSemanticMatches, checkPythonStatus } = require('../services/remotesearch');
const { mergeResults } = require('../services/rankprocessor');

// ==========================================
// 1. SYSTEM INTEGRITY
// ==========================================

router.get("/health", async (req, res) => {
    const start = Date.now();
    const dbStates = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

    const [pythonStatus, currentDbState] = await Promise.all([
        checkPythonStatus(),
        MongoConnection.getDbStatus()
    ]);

    const dbStatus = dbStates[currentDbState] || "unknown";
    const isHealthy = (pythonStatus === "connected" && dbStatus === "connected");

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? "UP" : "DEGRADED",
        timestamp: new Date(),
        latency: `${Date.now() - start}ms`,
        services: {
            database: { name: "MongoDB Atlas", status: dbStatus },
            semantic_engine: { name: "Python Flask / Qdrant", status: pythonStatus }
        }
    });
});

// ==========================================
// 2. DISCOVERY & FEED
// ==========================================

router.get('/api/feed', async (req, res) => {
    try {
        const { cursor, limit, skip } = req.query;
        const pageLimit = Math.min(parseInt(limit) || 10, 50);

        const feedResponse = await dbCrudOperator.getHomeFeed(cursor, pageLimit, skip);
        // Defined a new object that copies the result and adds proposedLinks
        return res.status(200).json({
            ...feedResponse,
            posts: feedResponse.data,
            proposedLinks: []
        });
    } catch (error) {
        console.error("Feed error:", error);
        return res.status(500).json({ message: "Error fetching feed" });
    }
});

router.get('/api/posts/:uuid', async (req, res) => {
    try {
        const post = await dbCrudOperator.getPublicPostByUuid(req.params.uuid);
        if (!post) return res.status(404).json({ message: "Post not found" });
        return res.status(200).json(post);
    } catch (error) {
        console.error("Fetch post error:", error);
        return res.status(500).json({ message: "Error fetching post" });
    }
});

// ==========================================
// 3. HYBRID SEARCH ENGINE
// ==========================================

router.get('/api/search', async (req, res) => {
    try {
        const { q, limit, mode = 'hybrid' } = req.query;
        if (!q) return res.status(400).json({ message: "Search query 'q' is required" });

        const searchLimit = Math.min(parseInt(limit) || 20, 50);

        // --- 4. INTELLECTUAL FALLBACK: Check Python Availability ---
        let effectiveMode = mode;
        if (mode === 'hybrid') {
            const status = await checkPythonStatus();
            if (status !== 'connected') {
                console.warn("Python Search Engine unreachable. Decoupling and falling back to Lexical mode.");
                effectiveMode = 'lexical';
            }
        }

        // --- Fast Path: Lexical (or fallback) ---
        if (effectiveMode === 'lexical') {
            const results = await dbCrudOperator.searchPostsByKeyword(q, searchLimit);
            const unified = results.map(r => ({ ...r, matchPercentage: 100 }));
            return res.status(200).json({
                query: q,
                mode: effectiveMode,
                count: unified.length,
                results: unified,
                proposedLinks: []
            });
        }

        // --- Intelligence Path: Hybrid ---
        const [mongoRes, pythonRes] = await Promise.allSettled([
            dbCrudOperator.searchPostsByKeyword(q, searchLimit),
            getSemanticMatches(q, searchLimit)
        ]);

        const keywordResults = mongoRes.status === 'fulfilled' ? mongoRes.value : [];
        const semanticMatches = pythonRes.status === 'fulfilled' ? pythonRes.value : [];
        console.log("keywordResults", keywordResults);
        console.log("semanticMatches", semanticMatches);

        // Hydration Logic: Fetch full docs for semantic matches not in lexical results
        const lexicalUuids = new Set(keywordResults.map(p => p.uuid));
        const missingUuids = semanticMatches
            .filter(p => !lexicalUuids.has(p.uuid))
            .map(p => p.uuid);

        let hydratedDocs = [];
        if (missingUuids.length > 0) {
            hydratedDocs = await Post.find({ uuid: { $in: missingUuids } }).lean();
        }

        // Merge and Rank
        // Note: hydratedDocs needs to be combined with semanticMatches scores in mergeResults
        const hybridResults = mergeResults(keywordResults, hydratedDocs);

        return res.status(200).json({
            query: q,
            mode: effectiveMode,
            count: hybridResults.length,
            results: hybridResults.slice(0, searchLimit),
            proposedLinks: []
        });

    } catch (error) {
        console.error("Search Route Error:", error);
        return res.status(500).json({ message: "Internal search error" });
    }
});

module.exports = router;