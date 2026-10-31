"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../config/redis"));
const prisma_1 = __importDefault(require("../config/prisma"));
const mailer_1 = __importDefault(require("../config/mailer"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const rate_limiter_service_1 = require("../services/rate-limiter.service");
const slack_notification_service_1 = require("../services/slack-notification.service");
const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;
exports.emailWorker = new bullmq_1.Worker("email-queue", async (job, token) => {
    console.log("Processing email:", job.data.emailId);
    const email = await prisma_1.default.email.findUnique({
        where: { id: job.data.emailId },
        include: { sender: true },
    });
    if (!email) {
        throw new Error(`Email not found: ${job.data.emailId}`);
    }
    if (email.status !== "SCHEDULED") {
        console.log(`Skipping email with status: ${email.status}`);
        return { skipped: true };
    }
    // Atomically claim the email and record its processing start time.
    const claim = await prisma_1.default.email.updateMany({
        where: {
            id: email.id,
            status: "SCHEDULED",
        },
        data: {
            status: "PROCESSING",
            processingStartedAt: new Date(),
        },
    });
    if (claim.count === 0) {
        console.log("Email already claimed by another worker.");
        return { skipped: true };
    }
    try {
        // Check hourly limit and minimum delay.
        const reservation = await (0, rate_limiter_service_1.reserveEmailSlot)(email.senderId, email.id, email.sender.hourlyLimit, email.sender.minDelayMs);
        if (!reservation.allowed) {
            const delay = Math.max(reservation.retryAfterMs, 1000);
            // Notify Slack only when the hourly limit is reached.
            if (reservation.reason === "Hourly email limit reached") {
                const notificationKey = `slack:notified:${email.senderId}`;
                const lock = await redis_1.default.set(notificationKey, "1", "EX", 3600, "NX");
                if (lock) {
                    try {
                        await (0, slack_notification_service_1.sendSlackNotification)(email.sender.userId, email.sender.email, email.sender.hourlyLimit);
                    }
                    catch (error) {
                        console.error("Slack notification error:", error);
                        await redis_1.default.del(notificationKey);
                    }
                }
            }
            // Return the email to SCHEDULED before deferring its job.
            await prisma_1.default.email.update({
                where: { id: email.id },
                data: {
                    status: "SCHEDULED",
                    processingStartedAt: null,
                },
            });
            await job.moveToDelayed(Date.now() + delay, token);
            console.log(`Email deferred for ${delay}ms`);
            throw new bullmq_1.DelayedError();
        }
        // Send email through Ethereal SMTP.
        let info;
        try {
            info = await mailer_1.default.sendMail({
                from: `"ReachInbox Test" <${process.env.ETHEREAL_USER}>`,
                to: email.recipient,
                subject: email.subject,
                text: email.body,
            });
        }
        catch (smtpError) {
            const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
            await prisma_1.default.email.update({
                where: { id: email.id },
                data: {
                    status: isFinalAttempt ? "FAILED" : "SCHEDULED",
                    processingStartedAt: null,
                    error: smtpError instanceof Error
                        ? smtpError.message
                        : "Unknown SMTP error",
                },
            });
            throw smtpError;
        }
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        // Record successful delivery.
        await prisma_1.default.email.update({
            where: { id: email.id },
            data: {
                status: "SENT",
                sentAt: new Date(),
                processingStartedAt: null,
                error: null,
            },
        });
        console.log("Email sent successfully!");
        console.log("Recipient:", email.recipient);
        console.log("Preview URL:", previewUrl);
        return {
            success: true,
            emailId: email.id,
            previewUrl,
        };
    }
    catch (error) {
        // Restore only emails that are still PROCESSING.
        await prisma_1.default.email.updateMany({
            where: {
                id: email.id,
                status: "PROCESSING",
            },
            data: {
                status: "SCHEDULED",
                processingStartedAt: null,
            },
        });
        throw error;
    }
}, {
    connection: redis_1.default,
    concurrency,
});
exports.emailWorker.on("completed", (job, result) => {
    console.log(`Job ${job.id} completed:`, result);
});
exports.emailWorker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
});
exports.emailWorker.on("error", (error) => {
    console.error("Worker error:", error);
});
console.log(`Email worker started with concurrency: ${concurrency}`);
