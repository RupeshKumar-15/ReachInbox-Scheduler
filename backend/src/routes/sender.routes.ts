import { Router, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// GET /api/senders
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const senders = await prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        hourlyLimit: true,
        minDelayMs: true,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, data: senders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch senders" });
  }
});

// POST /api/senders
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { email, displayName, hourlyLimit, minDelayMs } = req.body;

    if (!email || !displayName) {
      return res.status(400).json({ message: "Email and display name required" });
    }

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: String(email).trim().toLowerCase(),
        displayName: String(displayName).trim(),
        smtpHost: "smtp.ethereal.email",
        smtpPort: 587,
        smtpUser: process.env.ETHEREAL_USER || "",
        smtpPassword: process.env.ETHEREAL_PASS || "",
        hourlyLimit: Number(hourlyLimit) || 10,
        minDelayMs: Number(minDelayMs) || 60000,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        hourlyLimit: true,
        minDelayMs: true,
        isActive: true,
      },
    });

    return res.status(201).json({ success: true, data: sender });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create sender" });
  }
});

export default router;
