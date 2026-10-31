import { Queue, Worker, DelayedError } from "bullmq";
import Redis from "ioredis";

const connection = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
});

const queue = new Queue("delay-test-queue", { connection });

async function testDelayedJob() {
  const worker = new Worker(
    "delay-test-queue",
    async (job, token) => {
    if (!job.data.deferred) {
        console.log("First attempt: deferring job.");

        await job.updateData({
        ...job.data,
        deferred: true,
        });

        await job.moveToDelayed(Date.now() + 5000, token);

        throw new DelayedError();
    }

    console.log("Second attempt: job executed successfully.");

    return { success: true };
    },
    { connection }
  );

  try {
    const job = await queue.add(
      "delay-test",
      { message: "Test delayed execution" },
      { jobId: "bullmq-delay-test-" + Date.now() }
    );

    console.log("Job created:", job.id);

    await new Promise<void>((resolve, reject) => {
      worker.on("completed", (completedJob) => {
        console.log("Job completed:", completedJob.id);
        resolve();
      });

      worker.on("failed", (failedJob, error) => {
        reject(error);
      });
    });

    console.log("BullMQ delayed execution verified!");
  } finally {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
  }
}

testDelayedJob().catch(console.error);