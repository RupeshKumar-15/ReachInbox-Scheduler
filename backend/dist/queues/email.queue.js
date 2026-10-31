"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
exports.scheduleEmailJob = scheduleEmailJob;
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../config/redis"));
exports.emailQueue = new bullmq_1.Queue("email-queue", {
    connection: redis_1.default,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: {
            age: 86400,
            count: 1000,
        },
        removeOnFail: false,
    },
});
async function scheduleEmailJob(emailId, delay) {
    // Check whether a job already exists.
    const existingJob = await exports.emailQueue.getJob(emailId);
    if (existingJob) {
        const state = await existingJob.getState();
        // Keep jobs that are still active or waiting.
        if (!["completed", "failed"].includes(state)) {
            console.log(`Email job ${emailId} already exists with state: ${state}`);
            return existingJob;
        }
        // Remove terminal jobs so a scheduled email can be queued again.
        console.log(`Removing old ${state} job for email ${emailId}`);
        await existingJob.remove();
    }
    // Create a new job using the email ID for idempotency.
    const job = await exports.emailQueue.add("send-email", { emailId }, {
        jobId: emailId,
        delay: Math.max(0, delay),
    });
    console.log(`Scheduled email job: ${emailId}`);
    return job;
}
