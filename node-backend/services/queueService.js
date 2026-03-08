const { Queue, Worker, QueueEvents } = require('bullmq');
const redisConfig = require('../configurations/redis');

class QueueService {
    constructor() {
        this.queues = {};
        this.workers = {};
    }

    /**
     * Create or retrieve a queue
     * @param {string} name - Queue name
     */
    getQueue(name) {
        if (!this.queues[name]) {
            this.queues[name] = new Queue(name, {
                connection: redisConfig.getProducerConnection(),
                prefix: process.env.BULL_PREFIX || 'bull'
            });
        }
        return this.queues[name];
    }

    /**
     * Add a job to a queue
     * @param {string} queueName 
     * @param {string} jobName 
     * @param {object} data 
     * @param {object} options 
     */
    async addJob(queueName, jobName, data, options = {}) {
        const queue = this.getQueue(queueName);
        return await queue.add(jobName, data, options);
    }

    /**
     * Create a worker for a queue
     * @param {string} queueName 
     * @param {function} processor 
     * @param {object} options 
     */
    createWorker(queueName, processor, options = {}) {
        if (this.workers[queueName]) {
            console.warn(`Worker for queue ${queueName} already exists.`);
            return this.workers[queueName];
        }

        const worker = new Worker(queueName, processor, {
            connection: redisConfig.getConsumerConnection(),
            ...options
        });

        worker.on('completed', (job) => {
            console.log(`Job ${job.id} in queue ${queueName} completed.`);
        });

        worker.on('failed', (job, err) => {
            console.error(`Job ${job.id} in queue ${queueName} failed:`, err);
        });

        this.workers[queueName] = worker;
        return worker;
    }

    async shutdown() {
        const queueClosePromises = Object.values(this.queues).map(q => q.close());
        const workerClosePromises = Object.values(this.workers).map(w => w.close());
        await Promise.all([...queueClosePromises, ...workerClosePromises]);

        // Clear references
        this.queues = {};
        this.workers = {};

        await redisConfig.closeConnections();
        console.log('All queues and workers shut down.');
    }
}

module.exports = new QueueService();
