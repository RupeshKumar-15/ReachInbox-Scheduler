
import { Queue, Job } from "bullmq";
import redis from "../config/redis";

export interface EmailJobData {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobData>("email-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400,
      count: 1000,
    },
    removeOnFail: false,
  },
});

export async function scheduleEmailJob(
  emailId: string,
  delay: number
): Promise<Job<EmailJobData>> {
  // Check whether a job already exists.
  const existingJob = await emailQueue.getJob(emailId);

  if (existingJob) {
    const state = await existingJob.getState();

    // Keep jobs that are still active or waiting.
    if (!["completed", "failed"].includes(state)) {
      console.log(
        `Email job ${emailId} already exists with state: ${state}`
      );

      return existingJob;
    }

    // Remove terminal jobs so a scheduled email can be queued again.
    console.log(
      `Removing old ${state} job for email ${emailId}`
    );

    await existingJob.remove();
  }

  // Create a new job using the email ID for idempotency.
  const job = await emailQueue.add(
    "send-email",
    { emailId },
    {
      jobId: emailId,
      delay: Math.max(0, delay),
    }
  );

  console.log(`Scheduled email job: ${emailId}`);

  return job;
}
