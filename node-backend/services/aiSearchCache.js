const redisConfig = require('../configurations/redis');

const KEY_PREFIX = 'ai_search_cache';
const TTL_SECONDS = 3600;

function buildKey(query, limit) {
    const normalized = query.trim().toLowerCase();
    return `${KEY_PREFIX}:${normalized}:${limit}`;
}

async function getCached(query, limit) {
    const conn = await redisConfig.getProducerConnection();
    const key = buildKey(query, limit);
    const raw = await conn.get(key);

    if (!raw) {
        await conn.incr(`${KEY_PREFIX}:misses`);
        return null;
    }

    await conn.incr(`${KEY_PREFIX}:hits`);
    return JSON.parse(raw);
}

async function setCached(query, limit, data) {
    const conn = await redisConfig.getProducerConnection();
    const key = buildKey(query, limit);
    await conn.set(key, JSON.stringify(data), 'EX', TTL_SECONDS);
}

module.exports = { getCached, setCached, buildKey };
