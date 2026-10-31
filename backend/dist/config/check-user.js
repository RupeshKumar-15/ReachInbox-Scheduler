"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
async function checkUser() {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: {
                email: "test@example.com",
            },
            select: {
                id: true,
                email: true,
                name: true,
            },
        });
        console.log("Database user:", user);
    }
    catch (error) {
        console.error(error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
checkUser();
