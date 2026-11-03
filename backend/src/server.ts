
import dotenv from "dotenv";
dotenv.config();

import "./workers/email.worker";

import express from "express";
import cors from "cors";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { emailQueue } from "./queues/email.queue";
import { recoverScheduledEmails } from "./services/email-recovery.service";

import slackRoutes from "./routes/slack.routes";
import emailRoutes from "./routes/email.routes";
import campaignRoutes from "./routes/campaign.routes";
import senderRoutes from "./routes/sender.routes";
import campaignListRoutes from "./routes/campaign-list.routes";
import { initializeEmailIndex } from "./services/elasticsearch.service";
import authRoutes from "./routes/auth.routes";
import { authenticateToken } from "./middleware/auth.middleware";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Bull Board configuration
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});


app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://reachinbox-scheduler-brown-phi.vercel.app",
    ],
    credentials: true,
  })
);


app.use(express.json());
app.use("/api/emails", authenticateToken);
app.use("/api/senders", authenticateToken);
app.use("/api/campaigns", authenticateToken);

// Bull Board dashboard
app.use("/admin/queues", serverAdapter.getRouter());

// API routes
app.use("/api/slack", slackRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/senders", senderRoutes);
app.use("/api/campaigns", campaignListRoutes);
app.use("/api/auth", authRoutes);


app.get("/", (_req, res) => {
  res.json({
    message: "ReachInbox API is running!",
    version: "1.0.0",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  try {
    await initializeEmailIndex();
    await recoverScheduledEmails();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("Bull Board available at http://localhost:5000/admin/queues");
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

startServer();
