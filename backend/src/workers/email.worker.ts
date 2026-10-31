
import { Worker, DelayedError } from "bullmq";
import redis from "../config/redis";
import prisma from "../config/prisma";
import transporter from "../config/mailer";
import nodemailer from "nodemailer";

import { reserveEmailSlot } from "../services/rate-limiter.service";
import { sendSlackNotification } from "../services/slack-notification.service";
import { EmailJobData } from "../queues/email.queue";

const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

export const emailWorker = new Worker<EmailJobData>(
  "email-queue",
  async (job, token) => {
    console.log("Processing email:", job.data.emailId);

    const email = await prisma.email.findUnique({
      where: { id: job.data.emailId },
      include: { sender: true },
    });

    if (!email) {
      throw new Error(`Email not found: ${job.data.emailId}`);
    }

    if (email.status !== "SCHEDULED") {
      console.log(`Skipping email with status: ${email.status}`);
      return { skipped: true };
    }

    // Atomically claim the email and record its processing start time.
    const claim = await prisma.email.updateMany({
      where: {
        id: email.id,
        status: "SCHEDULED",
      },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(),
      },
    });

    if (claim.count === 0) {
      console.log("Email already claimed by another worker.");
      return { skipped: true };
    }

    try {
      // Check hourly limit and minimum delay.
      const reservation = await reserveEmailSlot(
        email.senderId,
        email.id,
        email.sender.hourlyLimit,
        email.sender.minDelayMs
      );

      if (!reservation.allowed) {
        const delay = Math.max(reservation.retryAfterMs, 1000);

        // Notify Slack only when the hourly limit is reached.
        if (reservation.reason === "Hourly email limit reached") {
          const notificationKey = `slack:notified:${email.senderId}`;

          const lock = await redis.set(
            notificationKey,
            "1",
            "EX",
            3600,
            "NX"
          );

          if (lock) {
            try {
              await sendSlackNotification(
                email.sender.userId,
                email.sender.email,
                email.sender.hourlyLimit
              );
            } catch (error) {
              console.error("Slack notification error:", error);
              await redis.del(notificationKey);
            }
          }
        }

        // Return the email to SCHEDULED before deferring its job.
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SCHEDULED",
            processingStartedAt: null,
          },
        });

        await job.moveToDelayed(Date.now() + delay, token);

        console.log(`Email deferred for ${delay}ms`);

        throw new DelayedError();
      }

      // Send email through Ethereal SMTP.
      let info;

      try {
        info = await transporter.sendMail({
          from: `"ReachInbox Test" <${process.env.ETHEREAL_USER}>`,
          to: email.recipient,
          subject: email.subject,
          text: email.body,
        });
      } catch (smtpError) {
        const isFinalAttempt =
          job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: isFinalAttempt ? "FAILED" : "SCHEDULED",
            processingStartedAt: null,
            error:
              smtpError instanceof Error
                ? smtpError.message
                : "Unknown SMTP error",
          },
        });

        throw smtpError;
      }

      const previewUrl = nodemailer.getTestMessageUrl(info);

      // Record successful delivery.
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          processingStartedAt: null,
          error: null,
        },
      });

      console.log("Email sent successfully!");
      console.log("Recipient:", email.recipient);
      console.log("Preview URL:", previewUrl);

      return {
        success: true,
        emailId: email.id,
        previewUrl,
      };
    } catch (error) {
      // Restore only emails that are still PROCESSING.
      await prisma.email.updateMany({
        where: {
          id: email.id,
          status: "PROCESSING",
        },
        data: {
          status: "SCHEDULED",
          processingStartedAt: null,
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency,
  }
);

emailWorker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

emailWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

emailWorker.on("error", (error) => {
  console.error("Worker error:", error);
});

console.log(`Email worker started with concurrency: ${concurrency}`);
