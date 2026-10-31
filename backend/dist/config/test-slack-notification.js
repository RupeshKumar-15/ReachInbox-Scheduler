"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const slack_notification_service_1 = require("../services/slack-notification.service");
async function testSlackNotification() {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: {
                email: "test@example.com",
            },
        });
        if (!user) {
            throw new Error("Test user not found.");
        }
        await (0, slack_notification_service_1.sendSlackNotification)(user.id, "sender@example.com", 10);
        console.log("Slack notification test completed!");
    }
    catch (error) {
        console.error("Slack notification test failed:", error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
testSlackNotification();
