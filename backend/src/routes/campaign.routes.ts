import { Router, Response } from "express";
import prisma from "../config/prisma";
import { scheduleCampaign } from "../services/email.service";
import { AuthRequest } from "../middleware/auth.middleware";

const router = Router();

router.post("/schedule", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      senderId,
      recipient,
      recipients,
      subject,
      body,
      scheduledAt,
    } = req.body;

    const recipientList: string[] = Array.isArray(recipients)
      ? recipients
      : typeof recipient === "string"
        ? [recipient]
        : [];

    const uniqueRecipients = [
      ...new Set(
        recipientList
          .filter((email): email is string => typeof email === "string")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];

    if (
      !senderId ||
      typeof subject !== "string" ||
      !subject.trim() ||
      typeof body !== "string" ||
      !body.trim() ||
      !scheduledAt ||
      uniqueRecipients.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Sender, recipients, subject, body and schedule time are required.",
      });
    }

    // Ensure the sender belongs to the authenticated user.
    const sender = await prisma.sender.findFirst({
      where: { id: String(senderId), userId, isActive: true },
      select: { id: true },
    });

    if (!sender) {
      return res.status(404).json({
        success: false,
        message: "Active sender account not found.",
      });
    }

    const invalidRecipients = uniqueRecipients.filter(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );

    if (invalidRecipients.length > 0) {
      return res.status(400).json({
        success: false,
        message: "One or more recipient email addresses are invalid.",
        invalidRecipients,
      });
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Scheduled time must be a valid future date.",
      });
    }

    const result = await scheduleCampaign({
      userId,
      senderId: sender.id,
      recipients: uniqueRecipients,
      subject: subject.trim(),
      body: body.trim(),
      scheduledAt: scheduledDate,
    });

    return res.status(201).json({
      success: true,
      message: "Campaign scheduled successfully.",
      data: {
        campaign: result.campaign,
        emails: result.emails,
        total: result.total,
      },
    });
  } catch (error) {
    console.error("Schedule campaign error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to schedule campaign.",
    });
  }
});

export default router;
