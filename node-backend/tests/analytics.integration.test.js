import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
const request = require('supertest');

// Mock DB before importing anything else
vi.mock('../database/connection', () => ({
    connectDB: vi.fn().mockResolvedValue(),
    closeConnection: vi.fn().mockResolvedValue(),
    getDbStatus: vi.fn().mockReturnValue(1),
    connectionEventListeners: vi.fn()
}));

const { app } = require('../server');
const queueService = require('../services/queueService');
const { Queue } = require('bullmq');
const redisConfig = require('../configurations/redis');

describe('Analytics Integration Tests (Real Redis)', () => {
    let analyticsQueue;

    beforeAll(async () => {
        analyticsQueue = new Queue('analytics-queue', {
            connection: redisConfig.getProducerConnection()
        });
        // Clean up queue before tests
        await analyticsQueue.drain(true);
    });

    afterAll(async () => {
        await analyticsQueue.close();
        await queueService.shutdown();
    });

    it('POST /api/analytics/events: should enqueue a job with correct data', async () => {
        const eventData = {
            postId: '699b625581aec74a7b33dadb', // use the user-provided postId
            userId: '699b625481aec74a7b33dad1', // use the user-provided userId
            type: 'view',
            source: 'web'
        };

        const res = await request(app)
            .post('/api/analytics/events')
            .send(eventData);

        expect(res.status).toBe(202);
        expect(res.body.message).toBe('Event queued for processing');

        // Verify job in queue
        const jobs = await analyticsQueue.getJobs(['waiting']);
        expect(jobs.length).toBeGreaterThan(0);

        const job = jobs.find(j => j.data.postId === eventData.postId);
        expect(job).toBeDefined();
        expect(job.data.userId).toBe(eventData.userId);
        expect(job.data.type).toBe(eventData.type);
    });

    it('POST /api/analytics/events: should return 400 for missing data', async () => {
        const res = await request(app)
            .post('/api/analytics/events')
            .send({ postId: '123' }); // Missing userId and type

        expect(res.status).toBe(400);
    });
});
