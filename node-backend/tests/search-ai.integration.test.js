import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// AI_SEARCH_ENABLED is read from process.env at module load time in routing/home.js.
// `import` statements are hoisted above all other code in an ESM file, so setting
// the env var here would run too late if the router were pulled in via `import` —
// require() it instead so this assignment actually executes first.
process.env.NODE_FEATURE_AI_SEARCH = 'TRUE';

// 1. ALL Mocks at the top
const aiSearchCache = require('../services/aiSearchCache');
const searchRouter = require('../routing/home');

const app = express();
app.use(bodyParser.json());
app.use('/', searchRouter);

describe('POST /api/search/ai', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the cached response and does not call Python on a cache hit', async () => {
        vi.spyOn(aiSearchCache, 'getCached').mockResolvedValue({
            query: 'cached query', expanded_query: 'cached query', similar_docs: [], relevant_ext_docs: [], degraded_legs: []
        });
        const fetchSpy = vi.spyOn(global, 'fetch');

        const res = await request(app).post('/api/search/ai').send({ query: 'cached query' });

        expect(res.status).toBe(200);
        expect(res.body.query).toBe('cached query');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('calls Python and populates the cache on a cache miss', async () => {
        vi.spyOn(aiSearchCache, 'getCached').mockResolvedValue(null);
        const setSpy = vi.spyOn(aiSearchCache, 'setCached').mockResolvedValue(undefined);
        vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({ query: 'new query', expanded_query: 'new query', similar_docs: [], relevant_ext_docs: [], degraded_legs: [] })
        });

        const res = await request(app).post('/api/search/ai').send({ query: 'new query' });

        expect(res.status).toBe(200);
        expect(setSpy).toHaveBeenCalled();
    });

    it('returns 400 when query is missing', async () => {
        const res = await request(app).post('/api/search/ai').send({});
        expect(res.status).toBe(400);
    });
});
