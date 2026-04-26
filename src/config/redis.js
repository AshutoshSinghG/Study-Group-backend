const { createClient } = require("redis");

let redisClient;

const connectRedis = async () => {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  redisClient = createClient({ url });

  redisClient.on("error", (error) => console.error("Redis Error:", error));
  redisClient.on("connect", () => console.log("Redis Connected"));

  await redisClient.connect();
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error("Redis client not initialized");
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };
