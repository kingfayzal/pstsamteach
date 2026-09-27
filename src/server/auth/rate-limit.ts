import "server-only";
import { db } from "@/server/db";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

export type RateLimiter = {
  hit(key: string, now?: Date): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
};

const DAY = 24 * 60 * 60 * 1000;

/** Occasionally clear out counters nobody has touched for a day, so the table stays small. */
async function pruneOccasionally(now: Date): Promise<void> {
  if (Math.random() >= 0.01) return;
  await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - DAY) } } });
}

/**
 * Fixed-window limiter stored in Postgres: one atomic upsert per hit, so the
 * limit holds across every serverless instance (unlike an in-memory counter).
 */
export function createRateLimiter({ name, limit, windowMs }: { name: string; limit: number; windowMs: number }): RateLimiter {
  const keyFor = (key: string) => `${name}:${key}`.slice(0, 300);

  async function hit(key: string, now = new Date()): Promise<RateLimitResult> {
    const id = keyFor(key);
    const expired = new Date(now.getTime() - windowMs);
    const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${id}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" <= ${expired} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${expired} THEN ${now} ELSE "RateLimit"."windowStart" END
      RETURNING "count", "windowStart"`;
    await pruneOccasionally(now);
    const { count, windowStart } = rows[0];
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterMs: allowed ? 0 : Math.max(0, new Date(windowStart).getTime() + windowMs - now.getTime()),
    };
  }

  async function reset(key: string): Promise<void> {
    await db.rateLimit.deleteMany({ where: { key: keyFor(key) } });
  }

  return { hit, reset };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const loginLimiter = createRateLimiter({ name: "login", limit: 8, windowMs: 15 * MINUTE });
export const signupLimiter = createRateLimiter({ name: "signup", limit: 6, windowMs: HOUR });
export const requestLimiter = createRateLimiter({ name: "request", limit: 10, windowMs: HOUR });
export const messageLimiter = createRateLimiter({ name: "message", limit: 30, windowMs: 10 * MINUTE });
