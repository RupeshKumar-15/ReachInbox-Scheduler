
import redis from "../config/redis";

const RATE_LIMIT_SCRIPT = `
local hourlyKey = KEYS[1]
local lastSentKey = KEYS[2]

local now = tonumber(ARGV[1])
local hourlyLimit = tonumber(ARGV[2])
local minDelayMs = tonumber(ARGV[3])
local emailId = ARGV[4]

-- Remove reservations older than one hour.
redis.call("ZREMRANGEBYSCORE", hourlyKey, "-inf", now - 3600000)

-- Check whether this email already has a reservation.
local alreadyReserved = redis.call("ZSCORE", hourlyKey, emailId)

-- Enforce minimum delay between sending attempts.
local lastSent = redis.call("GET", lastSentKey)

if lastSent then
  local wait = minDelayMs - (now - tonumber(lastSent))

  if wait > 0 then
    return {0, wait, 1}
  end
end

-- Count existing reservations.
local count = redis.call("ZCARD", hourlyKey)

-- Exclude this email's own reservation when checking the limit.
if alreadyReserved then
  count = count - 1
end

-- Enforce the hourly limit.
if count >= hourlyLimit then
  local oldest = redis.call("ZRANGE", hourlyKey, 0, 0, "WITHSCORES")

  local wait = 3600000

  if oldest[2] then
    wait = tonumber(oldest[2]) + 3600000 - now
  end

  return {0, math.max(wait, 1000), 2}
end

-- Create a reservation only for a new email.
if not alreadyReserved then
  redis.call("ZADD", hourlyKey, now, emailId)
  redis.call("PEXPIRE", hourlyKey, 7200000)
  redis.call("SET", lastSentKey, now, "PX", 7200000)
end

return {1, 0, 0}
`;

export async function reserveEmailSlot(
  senderId: string,
  emailId: string,
  hourlyLimit: number,
  minDelayMs: number
) {
  const result = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    2,
    `rate-limit:hourly:${senderId}`,
    `rate-limit:last-sent:${senderId}`,
    Date.now().toString(),
    hourlyLimit.toString(),
    minDelayMs.toString(),
    emailId
  )) as [number, number, number];

  const reasonCode = Number(result[2]);

  return {
    allowed: Number(result[0]) === 1,
    retryAfterMs: Number(result[1]),
    reason:
      reasonCode === 1
        ? "Minimum delay not reached"
        : reasonCode === 2
          ? "Hourly email limit reached"
          : undefined,
  };
}
