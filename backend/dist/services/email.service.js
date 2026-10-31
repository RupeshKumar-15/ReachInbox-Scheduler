"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleEmail = scheduleEmail;
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../config/prisma"));
const email_queue_1 = require("../queues/email.queue");
async function scheduleEmail(input) {
    const { scheduledAt } = input;
    if (scheduledAt.getTime() <= Date.now()) {
        throw new Error("Scheduled time must be in the future");
    }
    const sender = await prisma_1.default.sender.findUnique({
        where: { id: input.senderId },
    });
    if (!sender || !sender.isActive) {
        throw new Error("Sender not found or inactive");
    }
    const campaign = await prisma_1.default.campaign.findFirst({
        where: {
            id: input.campaignId,
            senderId: input.senderId,
        },
    });
    if (!campaign) {
        throw new Error("Campaign not found for this sender");
    }
    const email = await prisma_1.default.email.create({
        data: {
            campaignId: input.campaignId,
            senderId: input.senderId,
            recipient: input.recipient,
            subject: input.subject,
            body: input.body,
            scheduledAt,
            jobId: (0, crypto_1.randomUUID)(),
            status: "SCHEDULED",
        },
    });
    try {
        const delay = Math.max(0, scheduledAt.getTime() - Date.now());
        await (0, email_queue_1.scheduleEmailJob)(email.id, delay);
        return email;
    }
    catch (error) {
        // Compensate if queue insertion fails.
        await prisma_1.default.email.delete({
            where: { id: email.id },
        });
        throw error;
    }
}
