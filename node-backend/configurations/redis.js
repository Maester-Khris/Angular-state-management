const Redis = require('ioredis');

class RedisConfig {
    constructor() {
        this.producerConnection = null;
        this.consumerConnection = null;
    }

    getRedisOptions() {
        return {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
        };
    }

    getProducerConnection() {
        if (!this.producerConnection) {
            const redisUrl = process.env.REDIS_URL;

            if (redisUrl) {
                this.producerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
            } else {
                const options = this.getRedisOptions();
                this.producerConnection = new Redis(options);
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
                const options = this.getRedisOptions();
                this.consumerConnection = new Redis(options);
            }

            this.consumerConnection.on('error', (err) => console.error('Redis Consumer Error:', err));
        }
        return this.consumerConnection;
    }

    async closeConnections() {
        if (this.producerConnection) {
            await this.producerConnection.quit();
            this.producerConnection = null;
        }
        if (this.consumerConnection) {
            await this.consumerConnection.quit();
            this.consumerConnection = null;
        }
        console.log('Redis connections closed.');
    }
}

module.exports = new RedisConfig();
