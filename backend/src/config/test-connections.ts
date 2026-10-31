import prisma from "./prisma";
import redis from "./redis";

async function testConnections() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected successfully");

    const result = await redis.ping();
    console.log("Redis response:", result);
  } catch (error) {
    console.error("Connection test failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

testConnections();
