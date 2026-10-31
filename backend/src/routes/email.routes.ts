import { Router, Response } from "express";
import { EmailStatus, Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { searchEmailIds } from "../services/elasticsearch.service";
import { AuthRequest } from "../middleware/auth.middleware";

const router = Router();
const validStatuses = Object.values(EmailStatus);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const status = req.query.status as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    const page = Math.max(1, Number.parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit as string) || 10));

    if (status && status !== "ALL" && !validStatuses.includes(status as EmailStatus)) {
      return res.status(400).json({ success: false, message: "Invalid email status." });
    }

    let matchingIds: string[] | null = null;
    let elasticsearchAvailable = true;

    if (search) {
      try {
        matchingIds = await searchEmailIds(userId, search);
      } catch (error) {
        elasticsearchAvailable = false;
        console.error("Elasticsearch unavailable, using PostgreSQL:", error);
      }
    }

    const where: Prisma.EmailWhereInput = {
      sender: { is: { userId } },
      ...(status && status !== "ALL" ? { status: status as EmailStatus } : {}),
      ...(search
        ? elasticsearchAvailable
          ? { id: { in: matchingIds ?? [] } }
          : {
              OR: [
                { recipient: { contains: search, mode: "insensitive" } },
                { subject: { contains: search, mode: "insensitive" } },
                { body: { contains: search, mode: "insensitive" } },
              ],
            }
        : {}),
    };

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          recipient: true,
          subject: true,
          body: true,
          scheduledAt: true,
          sentAt: true,
          status: true,
          error: true,
          createdAt: true,
          campaignId: true,
          senderId: true,
        },
      }),
      prisma.email.count({ where }),
    ]);

    return res.json({
      success: true,
      data: emails,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get emails error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch emails." });
  }
});

export default router;
