
import prisma from "./prisma";
import redis from "./redis";
import { reserveEmailSlot } from "../services/rate-limiter.service";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function testRateLimiter() {
  const sender = await prisma.sender.findFirst();

  if (!sender) {
    throw new Error("No sender found.");
  }

  const testSenderId = `test-${sender.id}`;

  const hourlyKey = `rate-limit:hourly:${testSenderId}`;
  const lastSentKey = `rate-limit:last-sent:${testSenderId}`;

  try {
    // Test minimum delay.
    await redis.del(hourlyKey, lastSentKey);

    const first = await reserveEmailSlot(
      testSenderId,
      "test-email-1",
      2,
      5000
    );

    const second = await reserveEmailSlot(
      testSenderId,
      "test-email-2",
      2,
      5000
    );

    console.log("\nMinimum delay test:");
    console.log("First:", first);
    console.log("Second:", second);

    const minimumDelayPassed =
      first.allowed &&
      !second.allowed &&
      second.reason === "Minimum delay not reached";

    // Test hourly limit.
    await redis.del(hourlyKey, lastSentKey);

    const third = await reserveEmailSlot(
      testSenderId,
      "test-email-3",
      2,
      0
    );

    const fourth = await reserveEmailSlot(
      testSenderId,
      "test-email-4",
      2,
      0
    );

    const fifth = await reserveEmailSlot(
      testSenderId,
      "test-email-5",
      2,
      0
    );

    console.log("\nHourly limit test:");
    console.log("First:", third);
    console.log("Second:", fourth);
    console.log("Third:", fifth);

    const hourlyLimitPassed =
      third.allowed &&
      fourth.allowed &&
      !fifth.allowed &&
      fifth.reason === "Hourly email limit reached";

    // Test repeated reservation of the same email.
    await redis.del(hourlyKey, lastSentKey);

    const duplicateFirst = await reserveEmailSlot(
      testSenderId,
      "duplicate-email",
      2,
      5000
    );

    const duplicateSecond = await reserveEmailSlot(
      testSenderId,
      "duplicate-email",
      2,
      5000
    );

    const reservationCount = await redis.zcard(hourlyKey);

    console.log("\nDuplicate reservation test:");
    console.log("First attempt:", duplicateFirst);
    console.log("Immediate retry:", duplicateSecond);
    console.log("Unique reservations:", reservationCount);

    // Wait for the minimum delay to expire.
    await sleep(5100);

    const duplicateThird = await reserveEmailSlot(
      testSenderId,
      "duplicate-email",
      2,
      5000
    );

    const finalReservationCount = await redis.zcard(hourlyKey);

    console.log("Retry after delay:", duplicateThird);
    console.log("Reservations after retry:", finalReservationCount);

    const duplicateReservationPassed =
      duplicateFirst.allowed &&
      !duplicateSecond.allowed &&
      duplicateSecond.reason === "Minimum delay not reached" &&
      reservationCount === 1 &&
      duplicateThird.allowed &&
      finalReservationCount === 1;

    console.log("\n========== TEST RESULTS ==========");
    console.log("Minimum delay:", minimumDelayPassed ? "PASSED" : "FAILED");
    console.log("Hourly limit:", hourlyLimitPassed ? "PASSED" : "FAILED");
    console.log(
      "Duplicate reservation:",
      duplicateReservationPassed ? "PASSED" : "FAILED"
    );

    if (
      !minimumDelayPassed ||
      !hourlyLimitPassed ||
      !duplicateReservationPassed
    ) {
      throw new Error("One or more rate limiter tests failed.");
    }
  } finally {
    await redis.del(hourlyKey, lastSentKey);
    await redis.quit();
    await prisma.$disconnect();
  }
}

testRateLimiter().catch((error) => {
  console.error("Rate limiter test failed:", error);
  process.exitCode = 1;
});
