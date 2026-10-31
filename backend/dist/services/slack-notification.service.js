"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSlackNotification = sendSlackNotification;
const prisma_1 = __importDefault(require("../config/prisma"));
async function sendSlackNotification(userId, senderEmail, hourlyLimit) {
    const connection = await prisma_1.default.slackConnection.findFirst({
        where: {
            userId,
            connected: true,
        },
        orderBy: {
            updatedAt: "desc",
        },
    });
    if (!connection) {
        console.log("No connected Slack workspace for this user.");
        return;
    }
    const channel = process.env.SLACK_NOTIFICATION_CHANNEL;
    if (!channel) {
        throw new Error("SLACK_NOTIFICATION_CHANNEL is missing.");
    }
    const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            channel,
            text: `⚠️ *ReachInbox hourly limit reached*\n` +
                `Sender: ${senderEmail}\n` +
                `Hourly limit: ${hourlyLimit} emails\n` +
                `New emails will be deferred until sending capacity is available.`,
        }),
    });
    const result = await response.json();
    if (!result.ok) {
        throw new Error(`Slack notification failed: ${result.error}`);
    }
    console.log("Slack notification sent successfully.");
}
