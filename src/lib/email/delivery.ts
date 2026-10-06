const MINUTE = 60 * 1000;

/** Waits between attempts: a blip clears in a minute, an outage or a used-up daily quota takes longer. */
const BACKOFF_MS = [1 * MINUTE, 5 * MINUTE, 30 * MINUTE, 2 * 60 * MINUTE, 12 * 60 * MINUTE];

/** One first try plus a retry for every step of the backoff, about 15 hours in all. */
export const MAX_SEND_ATTEMPTS = BACKOFF_MS.length + 1;

/** How long to wait after failed attempt number `attempts` (1-based), or null to give up. */
export function retryDelayMs(attempts: number): number | null {
  if (attempts >= MAX_SEND_ATTEMPTS) return null;
  return BACKOFF_MS[Math.max(0, attempts - 1)];
}

/**
 * Resend errors that can clear up on their own. A bad key is included: once
 * someone fixes it in the deploy settings, the queued mail still goes out.
 * Everything else (a malformed message, an unverified sender) never will.
 */
const RETRYABLE = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "concurrent_idempotent_requests",
  "internal_server_error",
  "application_error",
  "missing_api_key",
  "invalid_api_key",
  "restricted_api_key",
]);

export function isRetryableResendError(name: string): boolean {
  return RETRYABLE.has(name);
}
