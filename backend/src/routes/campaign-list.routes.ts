import { Router, Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// GET /api/campaigns
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        _count: {
          select: { emails: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch campaigns" });
  }
});

export default router;
