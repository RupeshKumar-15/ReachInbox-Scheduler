import { QueueEvents } from "bullmq";
import { randomUUID } from "crypto";
import redis from "./redis";
import { emailQueue } from "../queues/email.queue";
import { emailWorker } from "../workers/email.worker";

async function testBullMQ() {
  const queueEvents = new QueueEvents("email-queue", {
    connection: redis,
  });

  try {
    await queueEvents.waitUntilReady();
    await emailWorker.waitUntilReady();

    const emailId = randomUUID();

    console.log("Scheduling test job...");

    const job = await emailQueue.add(
      "send-email",
      { emailId },
      {
        jobId: emailId,
        delay: 5000,
      }
    );

    console.log("Job scheduled:", job.id);
    console.log("Waiting for worker...");

    const result = await job.waitUntilFinished(queueEvents, 30000);

    console.log("Test successful!");
    console.log("Worker result:", result);
  } catch (error) {
    console.error("BullMQ test failed:", error);
    process.exitCode = 1;
  } finally {
    await emailWorker.close();
    await queueEvents.close();
    await emailQueue.close();
    redis.disconnect();
  }
}

testBullMQ();