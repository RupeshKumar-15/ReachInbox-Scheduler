"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
async function checkSenders() {
    try {
        const senders = await prisma_1.default.sender.findMany({
            include: {
                user: {
                    select: {
                        email: true,
                    },
                },
            },
        });
        console.log("Senders found:", senders.length);
        senders.forEach((sender) => {
            console.log({
                id: sender.id,
                senderEmail: sender.email,
                userEmail: sender.user.email,
                isActive: sender.isActive,
            });
        });
    }
    catch (error) {
        console.error(error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
checkSenders();
