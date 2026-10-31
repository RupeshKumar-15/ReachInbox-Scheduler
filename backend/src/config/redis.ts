
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const useTLS = process.env.REDIS_TLS === "true";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  ...(useTLS ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  console.log("Redis connected successfully");
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

export default redis;
