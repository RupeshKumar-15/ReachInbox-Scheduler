"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const redis_1 = __importDefault(require("./redis"));
const rate_limiter_service_1 = require("../services/rate-limiter.service");
async function testDeferredEmail() {
    const sender = await prisma_1.default.sender.findFirst();
    if (!sender) {
        throw new Error("No sender found.");
    }
    const testSenderId = `deferred-test-${sender.id}`;
    try {
        // Reserve the first email's sending slot.
        const first = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "deferred-email-1", 10, 5000);
        console.log("First reservation:", first);
        // Immediately try another email.
        const second = await (0, rate_limiter_service_1.reserveEmailSlot)(testSenderId, "deferred-email-2", 10, 5000);
        console.log("Second reservation:", second);
        if (first.allowed &&
            !second.allowed &&
            second.reason === "Minimum delay not reached") {
            console.log("Deferred-job condition verified!");
        }
        else {
            console.log("Test failed.");
        }
    }
    finally {
        await redis_1.default.del(`rate-limit:hourly:${testSenderId}`, `rate-limit:last-sent:${testSenderId}`);
        await redis_1.default.quit();
        await prisma_1.default.$disconnect();
    }
}
testDeferredEmail().catch(console.error);
