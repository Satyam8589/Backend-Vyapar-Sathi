import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let redisUrl = process.env.REDIS_URL || "";

// Clean up CLI prefix if present (e.g. "redis-cli -u redis://...")
if (redisUrl.startsWith("redis-cli -u ")) {
    redisUrl = redisUrl.replace("redis-cli -u ", "").trim();
}

export const cleanRedisUrl = redisUrl;

let redisClient = null;

if (redisUrl) {
    redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            return Math.min(times * 200, 3000);
        },
        tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    });

    redisClient.on("connect", () => {
        console.log("Redis client connecting...");
    });

    redisClient.on("ready", () => {
        console.log("Redis connected successfully");
    });

    redisClient.on("error", (err) => {
        console.error("Redis error:", err.message);
    });

    redisClient.on("reconnecting", () => {
        console.log("Redis reconnecting...");
    });
} else {
    console.warn("⚠️ REDIS_URL is not set in environment variables.");
}

// Dedicated connection options for BullMQ (requires maxRetriesPerRequest: null)
export const getBullMQConnectionOptions = () => {
    if (!redisUrl) return null;
    try {
        const urlObj = new URL(redisUrl);
        return {
            host: urlObj.hostname,
            port: Number(urlObj.port) || 6379,
            username: urlObj.username ? decodeURIComponent(urlObj.username) : undefined,
            password: urlObj.password ? decodeURIComponent(urlObj.password) : undefined,
            tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null,
        };
    } catch (err) {
        console.error("Error parsing REDIS_URL for BullMQ options:", err.message);
        return null;
    }
};

export default redisClient;
