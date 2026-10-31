import prisma from "./prisma";
import { sendSlackNotification } from "../services/slack-notification.service";

async function testSlackNotification() {
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: "test@example.com",
      },
    });

    if (!user) {
      throw new Error("Test user not found.");
    }

    await sendSlackNotification(
      user.id,
      "sender@example.com",
      10
    );

    console.log("Slack notification test completed!");
  } catch (error) {
    console.error("Slack notification test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testSlackNotification();