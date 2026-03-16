import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// 1. ALL Mocks at the top
vi.mock('../database/crud', () => ({
    searchPostsByKeyword: vi.fn(),
    getHomeFeed: vi.fn(),
    getPublicPostByUuid: vi.fn(),
    subscribeNewsletter: vi.fn()
}));

vi.mock('../services/remotesearch', () => ({
    getSemanticMatches: vi.fn(),
    checkPythonStatus: vi.fn()
}));

vi.mock('../services/rankprocessor', () => ({
    mergeResults: vi.fn()
}));

vi.mock('../database/connection', () => ({
    getDbStatus: vi.fn().mockReturnValue(1),
    connectDB: vi.fn().mockResolvedValue(),
    closeConnection: vi.fn().mockResolvedValue(),
    connectionEventListeners: vi.fn()
}));

vi.mock('../services/eventLoggerService', () => ({
    queueEvent: vi.fn(),
    initWorker: vi.fn()
}));

vi.mock('../database/models/post', () => ({
    // Mock the model object
    find: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([])
}));

vi.mock('../services/queueService', () => ({
    getQueue: vi.fn(),
    addJob: vi.fn(),
    createWorker: vi.fn(),
    shutdown: vi.fn()
}));

// Mock require cache to ensure our router gets the mocks
const searchRouter = require('../routing/home');
const dbCrudOperator = require('../database/crud');
const remoteSearch = require('../services/remotesearch');
const rankProcessor = require('../services/rankprocessor');

const app = express();
app.use(bodyParser.json());
app.use('/', searchRouter);

describe('Search API Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/search', () => {
        it('should return lexical results with meta when python is unavailable', async () => {
            console.log('DEBUG: Start lexical test');
            dbCrudOperator.searchPostsByKeyword.mockResolvedValue([
                { uuid: '1', title: 'Lexical' }
            ]);
            remoteSearch.checkPythonStatus.mockResolvedValue('disconnected');

            const response = await request(app)
                .get('/api/search')
                .query({ q: 'test' });

            console.log('DEBUG: Lexical test response received');
            expect(response.status).toBe(200);
            expect(response.body.meta.mode).toBe('lexical');
        }, 5000);

        it('should return 400 if query is missing', async () => {
            const response = await request(app).get('/api/search');
            expect(response.status).toBe(400);
        }, 5000);
    });
});
