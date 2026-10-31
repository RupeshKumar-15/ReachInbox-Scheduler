import prisma from "./prisma";
import redis from "./redis";
import { emailQueue } from "../queues/email.queue";
import { scheduleEmail } from "../services/email.service";

async function testScheduling() {
  try {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email: "test@example.com",
        googleId: "test-google-id",
      },
    });

    // Create a test sender
    const sender = await prisma.sender.create({
      data: {
        userId: user.id,
        email: "sender@example.com",
        smtpHost: "smtp.ethereal.email",
        smtpPort: 587,
        smtpUser: "test-user",
        smtpPassword: "test-password",
        hourlyLimit: 100,
      },
    });

    // Create a test campaign
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        subject: "ReachInbox Test",
        body: "Testing email scheduling.",
      },
    });

    // Schedule email 60 seconds from now
    const scheduledAt = new Date(Date.now() + 60_000);

    const email = await scheduleEmail({
      campaignId: campaign.id,
      senderId: sender.id,
      recipient: "recipient@example.com",
      subject: "Hello from ReachInbox",
      body: "This is a scheduling test.",
      scheduledAt,
    });

    console.log("\nEmail successfully scheduled!");
    console.log("Email ID:", email.id);
    console.log("Status:", email.status);
    console.log("Scheduled at:", email.scheduledAt);

    const job = await emailQueue.getJob(email.id);

    console.log("BullMQ job exists:", Boolean(job));
    console.log("BullMQ delay:", await job?.getState());
  } catch (error) {
    console.error("Scheduling test failed:", error);
    process.exitCode = 1;
  } finally {
    await emailQueue.close();
    redis.disconnect();
    await prisma.$disconnect();
  }
}

testScheduling();