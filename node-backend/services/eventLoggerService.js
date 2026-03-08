const queueService = require('./queueService');
const analyticsDAO = require('../database/analytics-dao');

class EventLoggerService {
    constructor() {
        this.ANALYTICS_QUEUE = 'analytics-queue';
        this.BATCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (standard, but we can customize)
    }

    /**
     * Entry point for incoming analytics events from the API
     * @param {object} eventData 
     */
    async queueEvent(eventData) {
        // Enqueue the job for later processing
        return await queueService.addJob(this.ANALYTICS_QUEUE, 'log-event', eventData);
    }

    /**
     * Process bulk analytics from the queue
     * This will be called by the scheduler or when queue reaches a threshold
     */
    async processAnalyticsBatch() {
        const queue = queueService.getQueue(this.ANALYTICS_QUEUE);

        // Fetch waiting jobs (up to a reasonable limit)
        const jobs = await queue.getWaiting();
        if (jobs.length === 0) return;

        console.log(`Processing batch of ${jobs.length} analytics events...`);

        const eventsToInsert = jobs.map(job => ({
            timestamp: job.data.timestamp ? new Date(job.data.timestamp) : new Date(),
            metadata: {
                postId: job.data.postId,
                userId: job.data.userId || null,
                guestId: job.data.guestId || null,
                type: job.data.type,
                source: job.data.source || 'web'
            }
        }));

        try {
            await analyticsDAO.batchInsertEvents(eventsToInsert);

            // If successful, remove the jobs from the queue
            const removePromises = jobs.map(job => job.remove());
            await Promise.all(removePromises);

            console.log(`Successfully batch inserted ${eventsToInsert.length} events to MongoDB.`);
        } catch (error) {
            console.error('Failed to batch insert analytics events:', error);
            // BullMQ's automatic retry logic could be leveraged here if needed,
            // but for batching, handled failures might need custom logic.
        }
    }

    /**
     * Initialize the worker for analytics
     */
    initWorker() {
        // In this implementation, the worker handles the batch processing
        // triggered by a 'scheduler' job rather than processing every job individually.
        queueService.createWorker(this.ANALYTICS_QUEUE, async (job) => {
            if (job.name === 'process-batch') {
                await this.processAnalyticsBatch();
            }
        });
    }
}

module.exports = new EventLoggerService();
