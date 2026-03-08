import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

// Mock DB before importing anything else
vi.mock('../database/connection', () => ({
    connectDB: vi.fn().mockResolvedValue(),
    closeConnection: vi.fn().mockResolvedValue(),
    getDbStatus: vi.fn().mockReturnValue(1),
    connectionEventListeners: vi.fn()
}));

const request = require('supertest');
const { app } = require('../server');
const queueService = require('../services/queueService');
const { Queue } = require('bullmq');
const redisConfig = require('../configurations/redis');

describe('Analytics Integration Tests (Real Redis)', () => {
    let analyticsQueue;

    beforeAll(async () => {
        analyticsQueue = queueService.getQueue('analytics-queue');
        // Clean up queue before tests
        await analyticsQueue.drain(true);
    });

    afterAll(async () => {
        // await analyticsQueue.close(); 
        // Do NOT close shared queue instances in afterAll as they are shared via singleton
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

        // Wait for job
        await new Promise(r => setTimeout(r, 500));

        // Verify job in queue
        const jobs = await analyticsQueue.getJobs(['waiting']);
        expect(jobs.length).toBeGreaterThan(0);

        const job = jobs.find(j => j.data.postId === eventData.postId);
        expect(job).toBeDefined();
        expect(job.data.userId).toBe(eventData.userId);
        expect(job.data.type).toBe(eventData.type);
    });

    it('POST /api/analytics/events (Guest): should enqueue a job with guestId', async () => {
        const eventData = {
            postId: '699b625581aec74a7b33dadb',
            guestId: 'guest-123',
            type: 'impression',
            source: 'web'
        };

        const res = await request(app)
            .post('/api/analytics/events')
            .send(eventData);

        expect(res.status).toBe(202);

        // Wait for job
        await new Promise(r => setTimeout(r, 500));

        const jobs = await analyticsQueue.getJobs(['waiting']);
        const job = jobs.find(j => j.data.guestId === eventData.guestId);
        expect(job).toBeDefined();
        expect(job.data.userId).toBeUndefined();
    });

    it('POST /api/analytics/batch: should enqueue multiple jobs', async () => {
        const batchData = {
            events: [
                { postId: 'id1', userId: 'u1', type: 'view' },
                { postId: 'id2', guestId: 'g1', type: 'share' }
            ]
        };

        const res = await request(app)
            .post('/api/analytics/batch')
            .send(batchData);

        expect(res.status).toBe(202);
        expect(res.body.message).toBe('2 events queued for processing');

        // Wait for jobs
        await new Promise(r => setTimeout(r, 500));

        const jobs = await analyticsQueue.getJobs(['waiting']);
        expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/analytics/events: should return 400 for missing both userId and guestId', async () => {
        const res = await request(app)
            .post('/api/analytics/events')
            .send({ postId: '123', type: 'view' });

        expect(res.status).toBe(400);
    });
});
