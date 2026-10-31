"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const email_service_1 = require("../services/email.service");
async function testRealEmail() {
    try {
        const sender = await prisma_1.default.sender.findFirst({
            where: { email: "sender@example.com" },
        });
        if (!sender) {
            throw new Error("Test sender not found in database.");
        }
        const campaign = await prisma_1.default.campaign.findFirst({
            where: { senderId: sender.id },
        });
        if (!campaign) {
            throw new Error("Test campaign not found in database.");
        }
        const email = await (0, email_service_1.scheduleEmail)({
            campaignId: campaign.id,
            senderId: sender.id,
            recipient: process.env.ETHEREAL_USER,
            subject: "ReachInbox SMTP Integration Test",
            body: "Congratulations! Your ReachInbox email scheduler successfully sent this test email through Ethereal SMTP.",
            scheduledAt: new Date(Date.now() + 15_000),
        });
        console.log("Test email scheduled successfully!");
        console.log("Email ID:", email.id);
        console.log("Recipient:", email.recipient);
        console.log("Scheduled at:", email.scheduledAt);
    }
    catch (error) {
        console.error("Test failed:", error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
testRealEmail();
