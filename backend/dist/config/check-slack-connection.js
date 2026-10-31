"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
async function checkSlackConnection() {
    try {
        const connections = await prisma_1.default.slackConnection.findMany({
            select: {
                userId: true,
                teamId: true,
                teamName: true,
                connected: true,
                updatedAt: true,
            },
        });
        console.log("Slack connections:", connections);
    }
    catch (error) {
        console.error(error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
checkSlackConnection();
