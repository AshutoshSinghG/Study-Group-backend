const Redis = require("ioredis");

let redisClient = null;

const connectRedis = () => {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      // FIXME: might need to tweak these for production
    });

    redisClient.on("connect", () => {
      console.log("Redis connected successfully");
    });

    redisClient.on("error", (err) => {
      console.log("Redis error, but we'll keep going:", err.message);
    });
  } catch (err) {
    console.log("Could not initialize Redis client:", err.message);
  }
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient };
