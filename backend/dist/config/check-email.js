"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
async function checkEmail() {
    try {
        const email = await prisma_1.default.email.findUnique({
            where: {
                id: "db27e6e4-e7c9-4a47-9e25-590b4cc7ed53",
            },
        });
        console.log("Email database record:");
        console.log({
            recipient: email?.recipient,
            subject: email?.subject,
            status: email?.status,
            sentAt: email?.sentAt,
            error: email?.error,
        });
    }
    catch (error) {
        console.error(error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
checkEmail();
