/**
 * @swagger
 * tags:
 *   - name: System
 *     description: Health checks and service monitoring
 *   - name: Discovery
 *     description: Feed retrieval and Hybrid Search Engine
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check system integrity
 *     description: Returns the connectivity status of MongoDB and the Python Semantic Engine.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: All systems operational
 *       503:
 *         description: One or more services are degraded (database or python engine)
 */

/**
 * @swagger
 * /api/feed:
 *   get:
 *     summary: Get initial or paginated home feed
 *     tags:
 *       - Discovery
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: The ID of the last post from the previous batch for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of posts to retrieve
 *     responses:
 *       200:
 *         description: Array of feed posts
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Hybrid Search Engine (Lexical + Semantic)
 *     description: Executes a dual-path search. Lexical search via MongoDB and Semantic search via the Python Flask/Qdrant service.
 *     tags:
 *       - Discovery
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: The search query string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Max number of results to return
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [hybrid, lexical]
 *           default: hybrid
 *         description: Choose between fast keyword matching or intelligent hybrid ranking
 *     responses:
 *       200:
 *         description: Combined and ranked search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                 mode:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       uuid:
 *                         type: string
 *                       title:
 *                         type: string
 *                       matchPercentage:
 *                         type: number
 *       400:
 *         description: Missing query parameter 'q'
 *       500:
 *         description: Server error
 */
