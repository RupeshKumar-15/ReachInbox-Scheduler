"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSlackAuthorizationUrl = createSlackAuthorizationUrl;
exports.handleSlackCallback = handleSlackCallback;
const crypto_1 = require("crypto");
const redis_1 = __importDefault(require("../config/redis"));
const prisma_1 = __importDefault(require("../config/prisma"));
async function createSlackAuthorizationUrl(userId) {
    const state = (0, crypto_1.randomUUID)();
    // Store the user ID temporarily to verify the OAuth callback.
    await redis_1.default.set(`slack:oauth:state:${state}`, userId, "EX", 600);
    const params = new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID,
        scope: "chat:write",
        redirect_uri: process.env.SLACK_REDIRECT_URI,
        state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
async function handleSlackCallback(code, state) {
    const stateKey = `slack:oauth:state:${state}`;
    // Validate and consume OAuth state to prevent CSRF and replay.
    const userId = await redis_1.default.get(stateKey);
    if (!userId) {
        throw new Error("Invalid or expired Slack OAuth state.");
    }
    await redis_1.default.del(stateKey);
    const params = new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
    });
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
    });
    const result = await response.json();
    if (!result.ok || !result.access_token || !result.team?.id) {
        throw new Error(`Slack OAuth failed: ${result.error || "Unknown error"}`);
    }
    // Save or update the Slack workspace connection.
    const connection = await prisma_1.default.slackConnection.upsert({
        where: {
            userId_teamId: {
                userId,
                teamId: result.team.id,
            },
        },
        update: {
            teamName: result.team.name,
            accessToken: result.access_token,
            connected: true,
        },
        create: {
            userId,
            teamId: result.team.id,
            teamName: result.team.name,
            accessToken: result.access_token,
            connected: true,
        },
    });
    return {
        connected: true,
        teamName: connection.teamName,
    };
}
