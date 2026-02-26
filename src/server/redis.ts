import { Redis } from "@upstash/redis";

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export async function pushOrderMetric(payload: {
  orderId: string;
  total: number;
  userEmail: string;
  createdAt: string;
}) {
  if (!redis) {
    return;
  }

  const serialized = JSON.stringify(payload);
  await Promise.allSettled([
    redis.lpush("orders:events", serialized),
    redis.ltrim("orders:events", 0, 199),
    redis.incr("orders:count"),
  ]);
}

