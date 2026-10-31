import { randomUUID } from "crypto";
import redis from "../config/redis";
import prisma from "../config/prisma";

export async function createSlackAuthorizationUrl(userId: string) {
  const state = randomUUID();

  // Store the user ID temporarily to verify the OAuth callback.
  await redis.set(`slack:oauth:state:${state}`, userId, "EX", 600);

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: "chat:write",
    redirect_uri: process.env.SLACK_REDIRECT_URI!,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function handleSlackCallback(
  code: string,
  state: string
) {
  const stateKey = `slack:oauth:state:${state}`;

  // Validate and consume OAuth state to prevent CSRF and replay.
  const userId = await redis.get(stateKey);

  if (!userId) {
    throw new Error("Invalid or expired Slack OAuth state.");
  }

  await redis.del(stateKey);

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    client_secret: process.env.SLACK_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.SLACK_REDIRECT_URI!,
  });

  const response = await fetch(
    "https://slack.com/api/oauth.v2.access",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  const result = await response.json() as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: {
      id: string;
      name: string;
    };
  };

  if (!result.ok || !result.access_token || !result.team?.id) {
    throw new Error(
      `Slack OAuth failed: ${result.error || "Unknown error"}`
    );
  }

  // Save or update the Slack workspace connection.
  const connection = await prisma.slackConnection.upsert({
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