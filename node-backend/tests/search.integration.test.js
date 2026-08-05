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
    });
});
