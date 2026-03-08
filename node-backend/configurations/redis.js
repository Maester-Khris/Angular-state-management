const Redis = require('ioredis');

class RedisConfig {
    constructor() {
        this.redisOptions = {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null, // Required for BullMQ
        };

        this.producerConnection = null;
        this.consumerConnection = null;
    }

    getProducerConnection() {
        if (!this.producerConnection) {
            const redisUrl = process.env.REDIS_URL;

            if (redisUrl) {
                this.producerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
            } else {
                this.producerConnection = new Redis(this.redisOptions);
            }

            this.producerConnection.on('error', (err) => console.error('Redis Producer Error:', err));
        }
        return this.producerConnection;
    }

    getConsumerConnection() {
        if (!this.consumerConnection) {
            const redisUrl = process.env.REDIS_URL;

            if (redisUrl) {
                this.consumerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
            } else {
                this.consumerConnection = new Redis(this.redisOptions);
            }

            this.consumerConnection.on('error', (err) => console.error('Redis Consumer Error:', err));
        }
        return this.consumerConnection;
    }

    async closeConnections() {
        if (this.producerConnection) await this.producerConnection.quit();
        if (this.consumerConnection) await this.consumerConnection.quit();
        console.log('Redis connections closed.');
    }
}

module.exports = new RedisConfig();
