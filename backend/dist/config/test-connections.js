"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const redis_1 = __importDefault(require("./redis"));
async function testConnections() {
    try {
        await prisma_1.default.$connect();
        console.log("PostgreSQL connected successfully");
        const result = await redis_1.default.ping();
        console.log("Redis response:", result);
    }
    catch (error) {
        console.error("Connection test failed:", error);
        process.exitCode = 1;
    }
    finally {
        await prisma_1.default.$disconnect();
        redis_1.default.disconnect();
    }
}
testConnections();
