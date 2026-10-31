
import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";

const router = Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

router.get("/google", (_req: Request, res: Response) => {
  const url = googleClient.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });

  res.redirect(url);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;

    if (!code) {
      return res.status(400).send("Google authorization code missing.");
    }

    const { tokens } = await googleClient.getToken(code);

    if (!tokens.id_token) {
      return res.status(401).send("Google ID token missing.");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const profile = ticket.getPayload();

    if (!profile?.sub || !profile.email || !profile.email_verified) {
      return res.status(401).send("Google account could not be verified.");
    }

    const user = await prisma.user.upsert({
      where: { googleId: profile.sub },
      update: {
        name: profile.name || profile.email,
        email: profile.email,
        avatar: profile.picture,
      },
      create: {
        googleId: profile.sub,
        name: profile.name || profile.email,
        email: profile.email,
        avatar: profile.picture,
      },
    });

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: "1d" }
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    console.error("Google authentication error:", error);
    return res.status(500).send("Google authentication failed.");
  }
});

export default router;
