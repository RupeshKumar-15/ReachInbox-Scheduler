"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const redis_1 = __importDefault(require("./redis"));
const email_queue_1 = require("../queues/email.queue");
const email_service_1 = require("../services/email.service");
async function testScheduling() {
    try {
        // Create a test user
        const user = await prisma_1.default.user.create({
            data: {
                name: "Test User",
                email: "test@example.com",
                googleId: "test-google-id",
            },
        });
        // Create a test sender
        const sender = await prisma_1.default.sender.create({
            data: {
                userId: user.id,
                email: "sender@example.com",
                smtpHost: "smtp.ethereal.email",
                smtpPort: 587,
                smtpUser: "test-user",
                smtpPassword: "test-password",
                hourlyLimit: 100,
            },
        });
        // Create a test campaign
        const campaign = await prisma_1.default.campaign.create({
            data: {
                userId: user.id,
                senderId: sender.id,
                subject: "ReachInbox Test",
                body: "Testing email scheduling.",
            },
        });
        // Schedule email 60 seconds from now
        const scheduledAt = new Date(Date.now() + 60_000);
        const email = await (0, email_service_1.scheduleEmail)({
            campaignId: campaign.id,
            senderId: sender.id,
            recipient: "recipient@example.com",
            subject: "Hello from ReachInbox",
            body: "This is a scheduling test.",
            scheduledAt,
        });
        console.log("\nEmail successfully scheduled!");
        console.log("Email ID:", email.id);
        console.log("Status:", email.status);
        console.log("Scheduled at:", email.scheduledAt);
        const job = await email_queue_1.emailQueue.getJob(email.id);
        console.log("BullMQ job exists:", Boolean(job));
        console.log("BullMQ delay:", await job?.getState());
    }
    catch (error) {
        console.error("Scheduling test failed:", error);
        process.exitCode = 1;
    }
    finally {
        await email_queue_1.emailQueue.close();
        redis_1.default.disconnect();
        await prisma_1.default.$disconnect();
    }
}
testScheduling();
