import prisma from "./prisma";
import redis from "./redis";
import { reserveEmailSlot } from "../services/rate-limiter.service";

async function testDeferredEmail() {
  const sender = await prisma.sender.findFirst();

  if (!sender) {
    throw new Error("No sender found.");
  }

  const testSenderId = `deferred-test-${sender.id}`;

  try {
    // Reserve the first email's sending slot.
    const first = await reserveEmailSlot(
      testSenderId,
      "deferred-email-1",
      10,
      5000
    );

    console.log("First reservation:", first);

    // Immediately try another email.
    const second = await reserveEmailSlot(
      testSenderId,
      "deferred-email-2",
      10,
      5000
    );

    console.log("Second reservation:", second);

    if (
      first.allowed &&
      !second.allowed &&
      second.reason === "Minimum delay not reached"
    ) {
      console.log("Deferred-job condition verified!");
    } else {
      console.log("Test failed.");
    }
  } finally {
    await redis.del(
      `rate-limit:hourly:${testSenderId}`,
      `rate-limit:last-sent:${testSenderId}`
    );

    await redis.quit();
    await prisma.$disconnect();
  }
}

testDeferredEmail().catch(console.error);