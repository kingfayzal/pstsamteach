import "server-only";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

type Options = { limit: number; windowMs: number; now?: () => number };

const MAX_TRACKED_KEYS = 10_000;

/**
 * Sliding-window limiter held in memory. Good for a single server instance;
 * swap for Redis/Upstash when running more than one.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: Options) {
  const hits = new Map<string, readonly number[]>();

  /** Drop keys whose hits have all expired, so the map can't grow without bound. */
  function sweep(current: number): void {
    for (const [key, times] of hits) {
      if (times.every((t) => current - t >= windowMs)) hits.delete(key);
    }
  }

  function hit(key: string): RateLimitResult {
    const current = now();
    if (hits.size > MAX_TRACKED_KEYS) sweep(current);
    const recent = (hits.get(key) ?? []).filter((t) => current - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterMs: windowMs - (current - recent[0]) };
    }
    const next = [...recent, current];
    hits.set(key, next);
    return { allowed: true, remaining: limit - next.length, retryAfterMs: 0 };
  }

  function reset(key: string): void {
    hits.delete(key);
  }

  return { hit, reset };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export const loginLimiter = createRateLimiter({ limit: 8, windowMs: FIFTEEN_MINUTES });
export const signupLimiter = createRateLimiter({ limit: 6, windowMs: ONE_HOUR });
export const requestLimiter = createRateLimiter({ limit: 10, windowMs: ONE_HOUR });
export const messageLimiter = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });
