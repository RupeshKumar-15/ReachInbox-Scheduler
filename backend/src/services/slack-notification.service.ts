import prisma from "../config/prisma";

export async function sendSlackNotification(
  userId: string,
  senderEmail: string,
  hourlyLimit: number
) {
  const connection = await prisma.slackConnection.findFirst({
    where: {
      userId,
      connected: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!connection) {
    console.log("No connected Slack workspace for this user.");
    return;
  }

  const channel = process.env.SLACK_NOTIFICATION_CHANNEL;

  if (!channel) {
    throw new Error("SLACK_NOTIFICATION_CHANNEL is missing.");
  }

  const response = await fetch(
    "https://slack.com/api/chat.postMessage",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text:
          `⚠️ *ReachInbox hourly limit reached*\n` +
          `Sender: ${senderEmail}\n` +
          `Hourly limit: ${hourlyLimit} emails\n` +
          `New emails will be deferred until sending capacity is available.`,
      }),
    }
  );

  const result = await response.json() as {
    ok: boolean;
    error?: string;
  };

  if (!result.ok) {
    throw new Error(`Slack notification failed: ${result.error}`);
  }

  console.log("Slack notification sent successfully.");
}