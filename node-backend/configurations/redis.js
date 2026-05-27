const Redis = require('ioredis');

const CONN_OPTIONS = {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 10000),
    enableOfflineQueue: false,
};

class RedisConfig {
    constructor() {
        this.producerConnection = null;
        this.consumerConnection = null;
        this._resolvedUrlPromise = null;
    }

    _isRateLimitError(err) {
        const code = err.code || '';
        const msg = (err.message || '').toLowerCase();
        return (
            code === 'ERR_RATE_LIMIT' ||
            code === 'RATELIMIT' ||
            msg.includes('rate limit') ||
            msg.includes('max requests')
        );
    }

    async _ping(url) {
        return new Promise((resolve, reject) => {
            let probe;
            try {
                probe = new Redis(url, {
                    connectTimeout: 3000,
                    maxRetriesPerRequest: 0,
                    retryStrategy: () => null,
                    enableOfflineQueue: false,
                });
            } catch (err) {
                reject(err);
                return;
            }

            const timer = setTimeout(() => {
                probe.disconnect();
                reject(new Error('connection timeout'));
            }, 3000);

            probe.once('ready', () => {
                clearTimeout(timer);
                probe.disconnect();
                resolve();
            });

            probe.once('error', (err) => {
                clearTimeout(timer);
                probe.disconnect();
                reject(err);
            });
        });
    }

    _resolveUrl() {
        if (!this._resolvedUrlPromise) {
            this._resolvedUrlPromise = (async () => {
                const customurl = `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
                const primaryUrl = process.env.REDIS_URL || customurl;
                const fallbackUrl = process.env.REDIS_FALLBACK_URL;

                try {
                    if (!primaryUrl) throw new Error('REDIS_URL not set');
                    await this._ping(primaryUrl);
                    console.log('[Redis:primary] connected');
                    return primaryUrl;
                } catch (err) {
                    console.warn(`[Redis:fallback] primary unavailable — reason: ${err.message}`);
                    console.log('[Redis:fallback] connected');
                    return fallbackUrl;
                }
            })();
        }
        return this._resolvedUrlPromise;
    }

    _makeConnection(url) {
        return new Redis(url, { ...CONN_OPTIONS });
    }

    async getProducerConnection() {
        if (!this.producerConnection) {
            const url = await this._resolveUrl();
            this.producerConnection = this._makeConnection(url);
            this.producerConnection.on('error', (err) =>
                console.error('[Redis] producer error:', err.message)
            );
        }
        return this.producerConnection;
    }

    async getConsumerConnection() {
        if (!this.consumerConnection) {
            const url = await this._resolveUrl();
            this.consumerConnection = this._makeConnection(url);
            this.consumerConnection.on('error', (err) =>
                console.error('[Redis] consumer error:', err.message)
            );
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
