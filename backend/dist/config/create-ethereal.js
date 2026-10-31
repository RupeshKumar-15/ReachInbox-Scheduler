"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
async function createEtherealAccount() {
    try {
        const account = await nodemailer_1.default.createTestAccount();
        console.log("\nEthereal account created successfully!\n");
        console.log("SMTP Host:", account.smtp.host);
        console.log("SMTP Port:", account.smtp.port);
        console.log("SMTP User:", account.user);
        console.log("SMTP Password:", account.pass);
    }
    catch (error) {
        console.error("Failed to create Ethereal account:", error);
    }
}
createEtherealAccount();
