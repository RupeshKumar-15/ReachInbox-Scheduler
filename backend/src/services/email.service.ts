
import { randomUUID } from "crypto";
import prisma from "../config/prisma";
import { emailQueue, scheduleEmailJob } from "../queues/email.queue";
import { indexEmail } from "./elasticsearch.service";

interface ScheduleEmailInput {
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

interface ScheduleCampaignInput {
  userId: string;
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: Date;
}

// Existing single-email scheduling function.
export async function scheduleEmail(input: ScheduleEmailInput) {
  const { scheduledAt } = input;
  

  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Scheduled time must be in the future");
  }

  const sender = await prisma.sender.findUnique({
    where: { id: input.senderId },
  });

  if (!sender || !sender.isActive) {
    throw new Error("Sender not found or inactive");
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      senderId: input.senderId,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found for this sender");
  }

  const email = await prisma.email.create({
    data: {
      campaignId: input.campaignId,
      senderId: input.senderId,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt,
      jobId: randomUUID(),
      status: "SCHEDULED",
    },
  });

   try {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  await scheduleEmailJob(email.id, delay);

  try {
    await indexEmail(email.id);
  } catch (error) {
    console.error("Elasticsearch indexing failed:", error);
  }

  return email;
    }catch (error) {
    await prisma.email.delete({
      where: { id: email.id },
    });

    throw error;
  }
}

// New bulk campaign scheduling function.
export async function scheduleCampaign(input: ScheduleCampaignInput) {
  const {
    userId,
    senderId,
    recipients,
    subject,
    body,
    scheduledAt,
  } = input;

  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Scheduled time must be in the future");
  }

  if (!recipients.length) {
    throw new Error("At least one recipient is required");
  }

  const sender = await prisma.sender.findFirst({
    where: {
      id: senderId,
      userId,
      isActive: true,
    },
  });

  if (!sender) {
    throw new Error("Active sender not found");
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId,
      senderId,
      subject,
      body,
    },
  });

  const createdEmails: { id: string }[] = [];

  try {
    // Create one email record for every recipient.
    for (const recipient of recipients) {
      const email = await prisma.email.create({
        data: {
          campaignId: campaign.id,
          senderId,
          recipient,
          subject,
          body,
          scheduledAt,
          jobId: randomUUID(),
          status: "SCHEDULED",
        },
        select: {
          id: true,
        },
      });

      createdEmails.push(email);
      try {
        await indexEmail(email.id);
        } catch (error) {
        console.error(`Failed to index email ${email.id}:`, error);
        }
    }

    // Add one BullMQ job for each email.
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    for (const email of createdEmails) {
      await scheduleEmailJob(email.id, delay);
    }

    return {
      campaign,
      emails: createdEmails,
      total: createdEmails.length,
    };
  } catch (error) {
    // Best-effort cleanup of jobs already added to BullMQ.
    await Promise.allSettled(
      createdEmails.map(async (email) => {
        const job = await emailQueue.getJob(email.id);

        if (job) {
          await job.remove();
        }
      })
    );

    // Remove database records and the campaign.
    await prisma.email.deleteMany({
      where: { campaignId: campaign.id },
    });

    await prisma.campaign.delete({
      where: { id: campaign.id },
    });

    throw error;
  }
}
