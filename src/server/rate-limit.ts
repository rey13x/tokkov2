import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 5000;

function now() {
  return Date.now();
}

function getIpFromRequest(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function compactBuckets() {
  const current = now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= current) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  // Fallback compacting if map keeps growing.
  const overflow = buckets.size - MAX_BUCKETS;
  const keys = buckets.keys();
  for (let index = 0; index < overflow; index += 1) {
    const next = keys.next();
    if (next.done) {
      break;
    }
    buckets.delete(next.value);
  }
}

export function enforceRateLimit(input: {
  request: Request;
  keyPrefix: string;
  limit: number;
  windowMs: number;
}) {
  compactBuckets();
  const ip = getIpFromRequest(input.request);
  const key = `${input.keyPrefix}:${ip}`;
  const current = now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= current) {
    buckets.set(key, {
      count: 1,
      resetAt: current + input.windowMs,
    });
    return null;
  }

  if (existing.count >= input.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - current) / 1000));
    return NextResponse.json(
      { message: "Terlalu banyak request. Coba beberapa saat lagi." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  existing.count += 1;
  buckets.set(key, existing);
  return null;
}
