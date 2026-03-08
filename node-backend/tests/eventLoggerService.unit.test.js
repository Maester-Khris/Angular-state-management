import { describe, it, expect, vi, beforeEach } from 'vitest';
const eventLoggerService = require('../services/eventLoggerService');
const queueService = require('../services/queueService');
const analyticsDAO = require('../database/analytics-dao');

describe('EventLoggerService Unit Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('queueEvent', () => {
        it('should add a log-event job to the analytics-queue', async () => {
            const eventData = {
                postId: '699b625581aec74a7b33dadb',
                userId: '699b625481aec74a7b33dad1',
                type: 'view'
            };
            const addJobSpy = vi.spyOn(queueService, 'addJob').mockResolvedValue({ id: 'job-1' });

            const result = await eventLoggerService.queueEvent(eventData);

            expect(addJobSpy).toHaveBeenCalledWith(
                'analytics-queue',
                'log-event',
                eventData
            );
            expect(result).toEqual({ id: 'job-1' });
        });
    });

    describe('processAnalyticsBatch', () => {
        it('should fetch waiting jobs and insert them via DAO', async () => {
            const jobs = [
                { id: '1', data: { postId: 'id1', userId: 'u1', type: 'view' }, remove: vi.fn().mockResolvedValue() },
                { id: '2', data: { postId: 'id2', guestId: 'g1', type: 'share' }, remove: vi.fn().mockResolvedValue() }
            ];
            const mockQueue = {
                getWaiting: vi.fn().mockResolvedValue(jobs)
            };
            vi.spyOn(queueService, 'getQueue').mockReturnValue(mockQueue);
            const batchInsertSpy = vi.spyOn(analyticsDAO, 'batchInsertEvents').mockResolvedValue();

            await eventLoggerService.processAnalyticsBatch();

            expect(batchInsertSpy).toHaveBeenCalledWith([
                expect.objectContaining({ metadata: expect.objectContaining({ postId: 'id1', userId: 'u1', guestId: null }) }),
                expect.objectContaining({ metadata: expect.objectContaining({ postId: 'id2', userId: null, guestId: 'g1' }) })
            ]);
            expect(jobs[0].remove).toHaveBeenCalled();
            expect(jobs[1].remove).toHaveBeenCalled();
        });

        it('should handle wrong data: non-recognized postId/userId (validation failure)', async () => {
            const jobs = [
                { id: '1', data: { postId: 'invalid-id', userId: 'invalid-user', type: 'view' }, remove: vi.fn().mockResolvedValue() }
            ];
            const mockQueue = {
                getWaiting: vi.fn().mockResolvedValue(jobs)
            };
            vi.spyOn(queueService, 'getQueue').mockReturnValue(mockQueue);

            const validationError = new Error('ValidationError: postId is not a valid ObjectId');
            vi.spyOn(analyticsDAO, 'batchInsertEvents').mockRejectedValue(validationError);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await eventLoggerService.processAnalyticsBatch();

            expect(analyticsDAO.batchInsertEvents).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith('Failed to batch insert analytics events:', validationError);

            expect(jobs[0].remove).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should return early if no jobs are waiting', async () => {
            const mockQueue = {
                getWaiting: vi.fn().mockResolvedValue([])
            };
            vi.spyOn(queueService, 'getQueue').mockReturnValue(mockQueue);
            const batchInsertSpy = vi.spyOn(analyticsDAO, 'batchInsertEvents');

            await eventLoggerService.processAnalyticsBatch();

            expect(batchInsertSpy).not.toHaveBeenCalled();
        });
    });
});
