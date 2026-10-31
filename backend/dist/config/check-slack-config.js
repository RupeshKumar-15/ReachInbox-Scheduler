"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const requiredVariables = [
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_REDIRECT_URI",
    "SLACK_NOTIFICATION_CHANNEL",
];
let missing = false;
for (const variable of requiredVariables) {
    const configured = Boolean(process.env[variable]);
    console.log(`${variable}: ${configured ? "Configured" : "MISSING"}`);
    if (!configured) {
        missing = true;
    }
}
if (missing) {
    console.log("\nPlease configure the missing variables.");
}
else {
    console.log("\nSlack configuration looks complete!");
}
