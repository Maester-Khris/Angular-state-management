import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// 1. ALL Mocks at the top
const MongoConnection = require('../database/connection');

vi.spyOn(MongoConnection, 'pingDb').mockResolvedValue(true);

import searchRouter from '../routing/home';

const app = express();
app.use(bodyParser.json());
app.use('/', searchRouter);

describe('GET /api/ping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 200 with mongo: up when the Mongo round trip succeeds', async () => {
        vi.spyOn(MongoConnection, 'pingDb').mockResolvedValue(true);

        const response = await request(app).get('/api/ping');

        expect(response.status).toBe(200);
        expect(response.body.mongo).toBe('up');
    });

    it('returns 503 with mongo: down when the Mongo round trip fails', async () => {
        vi.spyOn(MongoConnection, 'pingDb').mockRejectedValue(new Error('cluster paused'));

        const response = await request(app).get('/api/ping');

        expect(response.status).toBe(503);
        expect(response.body.mongo).toBe('down');
    });
});
