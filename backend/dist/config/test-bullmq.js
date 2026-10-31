"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const redis_1 = __importDefault(require("./redis"));
const email_queue_1 = require("../queues/email.queue");
const email_worker_1 = require("../workers/email.worker");
async function testBullMQ() {
    const queueEvents = new bullmq_1.QueueEvents("email-queue", {
        connection: redis_1.default,
    });
    try {
        await queueEvents.waitUntilReady();
        await email_worker_1.emailWorker.waitUntilReady();
        const emailId = (0, crypto_1.randomUUID)();
        console.log("Scheduling test job...");
        const job = await email_queue_1.emailQueue.add("send-email", { emailId }, {
            jobId: emailId,
            delay: 5000,
        });
        console.log("Job scheduled:", job.id);
        console.log("Waiting for worker...");
        const result = await job.waitUntilFinished(queueEvents, 30000);
        console.log("Test successful!");
        console.log("Worker result:", result);
    }
    catch (error) {
        console.error("BullMQ test failed:", error);
        process.exitCode = 1;
    }
    finally {
        await email_worker_1.emailWorker.close();
        await queueEvents.close();
        await email_queue_1.emailQueue.close();
        redis_1.default.disconnect();
    }
}
testBullMQ();
