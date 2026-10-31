import prisma from "./prisma";
import { emailQueue } from "../queues/email.queue";

async function cleanup() {
  const emailId = "5b34f041-617c-46e4-a4cf-e39dd44bd352";

  try {
    const job = await emailQueue.getJob(emailId);

    if (job) {
      await job.remove();
      console.log("Old BullMQ test job removed.");
    } else {
      console.log("No old BullMQ job found.");
    }

    await prisma.email.deleteMany({
      where: { id: emailId },
    });

    console.log("Old test email record cleaned up.");
  } catch (error) {
    console.error("Cleanup failed:", error);
  } finally {
    await emailQueue.close();
    await prisma.$disconnect();
  }
}

cleanup();