import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// Helper to create dual-purpose mocks (ESM default + CJS exports)
const createMock = (methods) => {
    const mock = {};
    methods.forEach(m => mock[m] = vi.fn());
    return { ...mock, default: mock };
};

// 1. ALL Mocks at the top
vi.mock('../database/crud', () => createMock([
    'searchPostsByKeyword', 'getHomeFeed', 'getPublicPostByUuid', 'subscribeNewsletter'
]));

vi.mock('../services/remotesearch', () => createMock([
    'getSemanticMatches', 'checkPythonStatus'
]));

vi.mock('../services/rankprocessor', () => createMock([
    'mergeResults'
]));

vi.mock('../database/connection', () => {
    const mock = {
        getDbStatus: vi.fn().mockReturnValue(1),
        connectDB: vi.fn().mockResolvedValue(),
        closeConnection: vi.fn().mockResolvedValue(),
        connectionEventListeners: vi.fn()
    };
    return { ...mock, default: mock };
});

vi.mock('../services/eventLoggerService', () => createMock([
    'queueEvent', 'initWorker'
]));

vi.mock('../database/models/post', () => {
    const mock = {
        find: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([])
    };
    return { ...mock, default: mock };
});

vi.mock('../services/queueService', () => createMock([
    'getQueue', 'addJob', 'createWorker', 'shutdown'
]));

// 2. Imports - will use the mocked versions
import searchRouter from '../routing/home';
import dbCrudOperator from '../database/crud';
import remoteSearch from '../services/remotesearch';

const app = express();
app.use(bodyParser.json());
app.use('/', searchRouter);

describe('Search API Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/search', () => {
        it('should return lexical results with meta when python is unavailable', async () => {
            dbCrudOperator.searchPostsByKeyword.mockResolvedValue([
                { uuid: '1', title: 'Lexical' }
            ]);
            remoteSearch.checkPythonStatus.mockResolvedValue('disconnected');

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
