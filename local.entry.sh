#!/bin/bash



# --- CONFIGURATION: REDIS ---
REDIS_CONTAINER="postair_redis"
REDIS_PASSWORD="redispassword123"
REDIS_PORT=6379
REDIS_UI_PORT=8001 # Access RedisInsight UI here

echo "🚀 Initializing Local Postair Infrastructure..."

# 1. Cleanup existing containers
echo "1. Cleaning up existing containers..."
docker rm -f ${REDIS_CONTAINER} 2>/dev/null || true

# 3. Launch Redis (using redis-stack for stream support and GUI)
echo "3. Launching Redis Stack (Streams/Insight)..."
docker run --name ${REDIS_CONTAINER} \
  -e REDIS_ARGS="--requirepass ${REDIS_PASSWORD}" \
  -p ${REDIS_PORT}:6379 \
  -p ${REDIS_UI_PORT}:8001 \
  -d redis/redis-stack-server:latest

# 4. Wait for Health Checks
echo "4. Waiting for services to be ready..."
until docker exec ${REDIS_CONTAINER} redis-cli ping > /dev/null 2>&1; do
  sleep 1
done

# 5. Configure Database Privileges
echo "5. Configuring database privileges..."
docker exec -it ${REDIS_CONTAINER} redis-cli -a ${REDIS_PASSWORD} INFO > /dev/null 2>&1;

# 6. Final Status Message
if [ $? -eq 0 ]; then
    echo "------------------------------------------------"
    echo "✅ INFRASTRUCTURE IS READY"
    echo "------------------------------------------------"
    echo "REDIS:"
    echo "  Host: localhost:${REDIS_PORT}"
    echo "  Pass: ${REDIS_PASSWORD}"
    echo "  UI:   http://localhost:${REDIS_UI_PORT} (RedisInsight)"
    echo "------------------------------------------------"
else
    echo "❌ Infrastructure initialization FAILED"
    exit 1
fi