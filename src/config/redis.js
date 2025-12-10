const redis = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

const redisSubscriber = redisClient.duplicate();

let pubClient, subClient;

const connectRedis = async () => {
  try {
    await redisClient.connect();
    await redisSubscriber.connect();
    
    pubClient = redisClient;
    subClient = redisSubscriber;
    
    console.log('Redis connected successfully');
    return { pubClient, subClient };
  } catch (error) {
    console.error('Redis connection error:', error);
    process.exit(1);
  }
};

const getRedisAdapter = () => {
  if (!pubClient || !subClient) {
    throw new Error('Redis clients not initialized');
  }
  return createAdapter(pubClient, subClient);
};

module.exports = {
  redisClient,
  redisSubscriber,
  connectRedis,
  getRedisAdapter,
};
