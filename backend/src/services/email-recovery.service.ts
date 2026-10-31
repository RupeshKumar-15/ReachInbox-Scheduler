
import prisma from "../config/prisma";
import { scheduleEmailJob } from "../queues/email.queue";

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function recoverScheduledEmails() {
  console.log("Starting email recovery...");

  const staleThreshold = new Date(
    Date.now() - PROCESSING_TIMEOUT_MS
  );

  // Recover stale processing emails and legacy records
  // that do not have a processing timestamp.
  const recovered = await prisma.email.updateMany({
    where: {
      status: "PROCESSING",
      OR: [
        {
          processingStartedAt: {
            lt: staleThreshold,
          },
        },
        {
          processingStartedAt: null,
        },
      ],
    },
    data: {
      status: "SCHEDULED",
      processingStartedAt: null,
    },
  });

  console.log(
    `Recovered ${recovered.count} stale processing emails.`
  );

  // Fetch all emails waiting to be sent.
  const scheduledEmails = await prisma.email.findMany({
    where: {
      status: "SCHEDULED",
    },
    select: {
      id: true,
      scheduledAt: true,
    },
  });

  // Restore their BullMQ jobs.
  for (const email of scheduledEmails) {
    const delay = Math.max(
      0,
      email.scheduledAt.getTime() - Date.now()
    );

    try {
      await scheduleEmailJob(email.id, delay);
    } catch (error) {
      console.error(
        `Failed to restore job for email ${email.id}:`,
        error
      );

      throw error;
    }
  }

  console.log(
    `Recovery complete. Checked ${scheduledEmails.length} scheduled emails.`
  );
}
