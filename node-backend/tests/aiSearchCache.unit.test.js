import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('aiSearchCache', () => {
    let cache, redisConfig, mockConn;

    beforeEach(() => {
        vi.resetModules();
        redisConfig = require('../configurations/redis');
        mockConn = {
            get: vi.fn(),
            set: vi.fn(),
            incr: vi.fn(),
        };
        vi.spyOn(redisConfig, 'getProducerConnection').mockResolvedValue(mockConn);
        cache = require('../services/aiSearchCache');
    });

    it('returns null and increments the miss counter on a cache miss', async () => {
        mockConn.get.mockResolvedValue(null);
        const result = await cache.getCached('redis caching', 5);
        expect(result).toBeNull();
        expect(mockConn.incr).toHaveBeenCalledWith('ai_search_cache:misses');
    });

    it('returns the parsed value and increments the hit counter on a cache hit', async () => {
        mockConn.get.mockResolvedValue(JSON.stringify({ query: 'redis caching', similar_docs: [] }));
        const result = await cache.getCached('redis caching', 5);
        expect(result).toEqual({ query: 'redis caching', similar_docs: [] });
        expect(mockConn.incr).toHaveBeenCalledWith('ai_search_cache:hits');
    });

    it('normalizes query casing/whitespace into the same cache key', async () => {
        mockConn.get.mockResolvedValue(null);
        await cache.getCached('  Redis Caching  ', 5);
        const [key] = mockConn.get.mock.calls[0];
        expect(key).toBe('ai_search_cache:redis caching:5');
    });

    it('setCached writes with a 1 hour TTL', async () => {
        await cache.setCached('redis caching', 5, { query: 'redis caching' });
        expect(mockConn.set).toHaveBeenCalledWith(
            'ai_search_cache:redis caching:5',
            JSON.stringify({ query: 'redis caching' }),
            'EX',
            3600
        );
    });
});
