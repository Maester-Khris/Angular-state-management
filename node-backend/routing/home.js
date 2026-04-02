const router = require('express').Router();
const dbCrudOperator = require('../database/crud');
const MongoConnection = require('../database/connection');
const Post = require('../database/models/post');
const remoteSearchSvc = require('../services/remotesearch');
const { mergeResults } = require('../services/rankprocessor');
const eventLoggerService = require('../services/eventLoggerService');

// ==========================================
// 1. SYSTEM INTEGRITY
// ==========================================

router.get("/health", async (req, res) => {
    const start = Date.now();
    const dbStates = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

    const [pythonStatus, currentDbState] = await Promise.all([
        remoteSearchSvc.checkPythonStatus(),
        MongoConnection.getDbStatus()
    ]);

    const dbStatus = dbStates[currentDbState] || "unknown";

    // Core logic: The Node server is functional if the Database is connected.
    // Python (Semantic Search) is considered an optional enhancement for basic browsing.
    const isFunctional = (dbStatus === "connected");
    const isPerfect = isFunctional && (pythonStatus === "connected");

    res.status(isFunctional ? 200 : 503).json({
        status: isPerfect ? "UP" : (isFunctional ? "DEGRADED" : "DOWN"),
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
        console.error("Feed error:", error.message);
        return res.status(500).json({ message: "Unable to fetch home feed" });
    }
});

router.get('/api/posts/:uuid', async (req, res) => {
    try {
        const post = await dbCrudOperator.getPublicPostByUuid(req.params.uuid);
        if (!post) return res.status(404).json({ message: "Post not found" });
        return res.status(200).json(post);
    } catch (error) {
        console.error("Fetch post error:", error.message);
        return res.status(500).json({ message: "Unable to load post details" });
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
            const status = await remoteSearchSvc.checkPythonStatus();
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
                meta: {
                    mode: effectiveMode,
                    python_available: false // Always false in lexical fallback
                }
            });
        }

        // --- Intelligence Path: Hybrid ---
        const [mongoRes, pythonRes] = await Promise.allSettled([
            dbCrudOperator.searchPostsByKeyword(q, searchLimit),
            remoteSearchSvc.getSemanticMatches(q, searchLimit)
        ]);

        const keywordResults = mongoRes.status === 'fulfilled' ? mongoRes.value : [];
        const semanticMatches = pythonRes.status === 'fulfilled' ? pythonRes.value : [];

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

        const pythonStatus = await remoteSearchSvc.checkPythonStatus();

        return res.status(200).json({
            query: q,
            mode: effectiveMode,
            count: hybridResults.length,
            results: hybridResults.slice(0, searchLimit),
            meta: {
                mode: effectiveMode,
                python_available: pythonStatus === 'connected'
            }
        });

    } catch (error) {
        console.error("Search Route Error:", error.message);
        return res.status(500).json({ message: "Search service temporarily unavailable" });
    }
});

router.post('/api/search/ai', async (req, res) => {
    try {
        const { query, limit = 5 } = req.body;

        if (!query) {
            return res.status(400).json({ message: "Search query 'query' is required" });
        }

        const pythonBaseUrl = process.env.NODE_ENV === 'production'
            ? process.env.PYTHON_SERVICE_URL
            : 'http://localhost:5000';

        const pythonUrl = `${pythonBaseUrl}/search/ai`;

        const pythonResponse = await fetch(pythonUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Key': process.env.SHARED_SECURITY_KEY
            },
            body: JSON.stringify({ query, limit })
        });

        if (!pythonResponse.ok) {
            const errorText = await pythonResponse.text();
            console.error(`Python AI search error ${pythonResponse.status}: ${errorText}`);
            return res.status(pythonResponse.status).json({
                message: 'AI search service error'
            });
        }

        // Forward Python response exactly — no transformation
        const data = await pythonResponse.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('AI search proxy error:', error.message);
        return res.status(500).json({ message: 'AI search temporarily unavailable' });
    }
});


// ==========================================
// 4. NEWSLETTER
// ==========================================

router.post('/api/newsletter', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: "A valid email is required" });
        }

        const result = await dbCrudOperator.subscribeNewsletter(email);
        return res.status(200).json({
            message: "Successfully subscribed to newsletter",
            data: result
        });
    } catch (error) {
        console.error("Newsletter error:", error.message);
        return res.status(500).json({ message: "Unable to process newsletter subscription" });
    }
});

// ==========================================
// 5. ANALYTICS
// ==========================================

router.post('/api/analytics/events', async (req, res) => {
    console.log(`[AnalyticsRoute] Individual event received: ${req.body.type} for ${req.body.postId}`);
    try {
        const { postId, userId, guestId, type, source } = req.body;
        if (!postId || (!userId && !guestId) || !type) {
            return res.status(400).json({ message: "postId, (userId or guestId), and type are required" });
        }

        // Add to queue for asynchronous processing
        await eventLoggerService.queueEvent({ postId, userId, guestId, type, source });

        return res.status(202).json({ message: "Event queued for processing" });
    } catch (error) {
        console.error("Analytics error:", error.message);
        return res.status(500).json({ message: "Unable to process analytics event" });
    }
});

router.post('/api/analytics/batch', async (req, res) => {
    console.log(`[AnalyticsRoute] Batch received with ${req.body.events?.length || 0} events`);
    try {
        const { events } = req.body;
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ message: "Array of events is required" });
        }

        const validEvents = events.filter(e => e.postId && (e.userId || e.guestId) && e.type);

        // Enqueue all valid events
        for (const event of validEvents) {
            await eventLoggerService.queueEvent(event);
        }

        return res.status(202).json({
            message: `${validEvents.length} events queued for processing`,
            ignored: events.length - validEvents.length
        });
    } catch (error) {
        console.error("Analytics batch error:", error.message);
        return res.status(500).json({ message: "Unable to process analytics batch" });
    }
});

module.exports = router;