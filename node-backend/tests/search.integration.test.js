import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// 1. ALL Mocks at the top
const dbCrudOperator = require('../database/crud');
const remoteSearch = require('../services/remotesearch');
const Post = require('../database/models/post');

vi.spyOn(dbCrudOperator, 'searchPostsByKeyword').mockImplementation(async () => []);
vi.spyOn(remoteSearch, 'checkPythonStatus').mockImplementation(async () => 'disconnected');
vi.spyOn(Post, 'find').mockReturnValue({
    lean: vi.fn().mockResolvedValue([])
});

import searchRouter from '../routing/home';

const app = express();
app.use(bodyParser.json());
app.use('/', searchRouter);

describe('Search API Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/search', () => {
        it('should return lexical results with meta when python is unavailable', async () => {
            vi.spyOn(dbCrudOperator, 'searchPostsByKeyword').mockResolvedValue([
                { uuid: '1', title: 'Lexical' }
            ]);
            vi.spyOn(remoteSearch, 'checkPythonStatus').mockResolvedValue('disconnected');

            const response = await request(app)
                .get('/api/search')
                .query({ q: 'test' });

            expect(response.status).toBe(200);
            expect(response.body.meta.mode).toBe('lexical');
        });

        it('should return 400 if query is missing', async () => {
            const response = await request(app).get('/api/search');
            expect(response.status).toBe(400);
        });

        it('rewards cross-leg consensus and preserves semantic rank order despite an unordered hydration fetch', async () => {
            const lexicalDoc = { uuid: 'A', title: 'Lexical+Semantic', score: 5 };

            vi.spyOn(dbCrudOperator, 'searchPostsByKeyword').mockResolvedValue([lexicalDoc]);
            vi.spyOn(remoteSearch, 'checkPythonStatus').mockResolvedValue('connected');
            vi.spyOn(remoteSearch, 'getSemanticMatches').mockResolvedValue([
                { uuid: 'A' }, // found by both legs - rank 1 semantically too
                { uuid: 'B' }, // semantic-only, rank 2
                { uuid: 'C' }, // semantic-only, rank 3
            ]);
            // Mongo's real $in fetch gives no order guarantee - simulate it shuffled
            vi.spyOn(Post, 'find').mockReturnValue({
                lean: vi.fn().mockResolvedValue([
                    { uuid: 'C', title: 'C' },
                    { uuid: 'B', title: 'B' },
                ])
            });

            const response = await request(app)
                .get('/api/search')
                .query({ q: 'test', mode: 'hybrid' });

            expect(response.status).toBe(200);
            const uuids = response.body.results.map(r => r.uuid);

            // Consensus doc (found by both legs) must rank first, not last
            expect(uuids[0]).toBe('A');
            // Semantic-only docs must keep Python's rank order (B before C),
            // not Mongo's unordered hydration-fetch order (C before B)
            expect(uuids.indexOf('B')).toBeLessThan(uuids.indexOf('C'));
        });
    });
});
