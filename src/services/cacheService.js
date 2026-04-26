const { getRedisClient } = require("../config/redis");

const generateLeaderboardKey = (groupId, goalId, query) => {
  return `leaderboard:${groupId}:${goalId}:${JSON.stringify(query)}`;
};

const generateProgressKey = (groupId, goalId) => {
  return `progress:${groupId}:${goalId}`;
};

const cacheGet = async (key) => {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Redis Get Error:", error);
    return null;
  }
};

const cacheSet = async (key, value, ttl = 3600) => {
  try {
    const client = getRedisClient();
    await client.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error("Redis Set Error:", error);
  }
};

const invalidateGroupCache = async (groupId) => {
  try {
    const client = getRedisClient();
    // Use SCAN or KEYS to find all keys for a given group, but since KEYS is blocking,
    // let's do a simple implementation or keep an index of keys.
    // For simplicity, we can use KEYS in development.
    const keys = await client.keys(`*:${groupId}:*`);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error("Redis Invalidate Error:", error);
  }
};

module.exports = {
  generateLeaderboardKey,
  generateProgressKey,
  cacheGet,
  cacheSet,
  invalidateGroupCache
};
