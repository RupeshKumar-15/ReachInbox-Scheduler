"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const redis_1 = __importDefault(require("./redis"));
const rate_limiter_service_1 = require("../services/rate-limiter.service");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function testRateLimiter() {
    const sender = await prisma_1.default.sender.findFirst();
    if (!sender) {
        throw new Error("No sender found.");
    }
    const testSenderId = `test-${sender.id}`;
    const hourlyKey = `rate-limit:hourly:${testSenderId}`;
    const lastSentKey = `rate-limit:last-sent:${testSenderId}`;
    try {
        // Test minimum delay.
        await redis_1.default.del(hourlyKey, lastSentKey);
        const first = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "test-email-1", 2, 5000);
        const second = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "test-email-2", 2, 5000);
        console.log("\nMinimum delay test:");
        console.log("First:", first);
        console.log("Second:", second);
        const minimumDelayPassed = first.allowed &&
            !second.allowed &&
            second.reason === "Minimum delay not reached";
        // Test hourly limit.
        await redis_1.default.del(hourlyKey, lastSentKey);
        const third = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "test-email-3", 2, 0);
        const fourth = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "test-email-4", 2, 0);
        const fifth = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "test-email-5", 2, 0);
        console.log("\nHourly limit test:");
        console.log("First:", third);
        console.log("Second:", fourth);
        console.log("Third:", fifth);
        const hourlyLimitPassed = third.allowed &&
            fourth.allowed &&
            !fifth.allowed &&
            fifth.reason === "Hourly email limit reached";
        // Test repeated reservation of the same email.
        await redis_1.default.del(hourlyKey, lastSentKey);
        const duplicateFirst = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "duplicate-email", 2, 5000);
        const duplicateSecond = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "duplicate-email", 2, 5000);
        const reservationCount = await redis_1.default.zcard(hourlyKey);
        console.log("\nDuplicate reservation test:");
        console.log("First attempt:", duplicateFirst);
        console.log("Immediate retry:", duplicateSecond);
        console.log("Unique reservations:", reservationCount);
        // Wait for the minimum delay to expire.
        await sleep(5100);
        const duplicateThird = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "duplicate-email", 2, 5000);
        const finalReservationCount = await redis_1.default.zcard(hourlyKey);
        console.log("Retry after delay:", duplicateThird);
        console.log("Reservations after retry:", finalReservationCount);
        const duplicateReservationPassed = duplicateFirst.allowed &&
            !duplicateSecond.allowed &&
            duplicateSecond.reason === "Minimum delay not reached" &&
            reservationCount === 1 &&
            duplicateThird.allowed &&
            finalReservationCount === 1;
        console.log("\n========== TEST RESULTS ==========");
        console.log("Minimum delay:", minimumDelayPassed ? "PASSED" : "FAILED");
        console.log("Hourly limit:", hourlyLimitPassed ? "PASSED" : "FAILED");
        console.log("Duplicate reservation:", duplicateReservationPassed ? "PASSED" : "FAILED");
        if (!minimumDelayPassed ||
            !hourlyLimitPassed ||
            !duplicateReservationPassed) {
            throw new Error("One or more rate limiter tests failed.");
        }
    }
    finally {
        await redis_1.default.del(hourlyKey, lastSentKey);
        await redis_1.default.quit();
        await prisma_1.default.$disconnect();
    }
}
testRateLimiter().catch((error) => {
    console.error("Rate limiter test failed:", error);
    process.exitCode = 1;
});
