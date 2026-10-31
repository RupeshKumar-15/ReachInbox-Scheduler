"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const slack_service_1 = require("../services/slack.service");
const router = (0, express_1.Router)();
// Start Slack OAuth
router.get("/connect", async (req, res) => {
    try {
        // Temporary: replace with authenticated Google user ID later.
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(401).json({
                error: "User authentication required.",
            });
        }
        const authorizationUrl = await (0, slack_service_1.createSlackAuthorizationUrl)(userId);
        return res.json({ authorizationUrl });
    }
    catch (error) {
        console.error("Slack connection error:", error);
        return res.status(500).json({
            error: "Unable to start Slack authorization.",
        });
    }
});
// Slack OAuth callback
router.get("/callback", async (req, res) => {
    try {
        const code = req.query.code;
        const state = req.query.state;
        if (typeof code !== "string" || typeof state !== "string") {
            return res.status(400).json({
                error: "Missing or invalid OAuth parameters.",
            });
        }
        const result = await (0, slack_service_1.handleSlackCallback)(code, state);
        return res.json({
            message: "Slack connected successfully!",
            ...result,
        });
    }
    catch (error) {
        console.error("Slack callback error:", error);
        return res.status(400).json({
            error: "Slack authorization failed.",
        });
    }
});
exports.default = router;
