"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const email_queue_1 = require("../queues/email.queue");
async function cleanup() {
    const emailId = "5b34f041-617c-46e4-a4cf-e39dd44bd352";
    try {
        const job = await email_queue_1.emailQueue.getJob(emailId);
        if (job) {
            await job.remove();
            console.log("Old BullMQ test job removed.");
        }
        else {
            console.log("No old BullMQ job found.");
        }
        await prisma_1.default.email.deleteMany({
            where: { id: emailId },
        });
        console.log("Old test email record cleaned up.");
    }
    catch (error) {
        console.error("Cleanup failed:", error);
    }
    finally {
        await email_queue_1.emailQueue.close();
        await prisma_1.default.$disconnect();
    }
}
cleanup();
