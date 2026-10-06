/** Only allow same-site relative paths as post-login destinations (no open redirects). */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

type RoleLike = { role: "STUDENT" | "TEACHER" | "ADMIN"; status: "ACTIVE" | "PENDING" | "SUSPENDED" };

/** Where each kind of account lands after signing in. */
export function homePathFor(user: RoleLike): string {
  if (user.role === "ADMIN") return "/admin";
  if (user.role === "TEACHER") return user.status === "PENDING" ? "/teach/pending" : "/teach";
  return "/learn";
}

/** Where an account waits until its email address is confirmed. */
export const CHECK_EMAIL_PATH = "/check-email";

/**
 * Where a request for a signed-in page has to go instead, or null to let it
 * through. Nothing that needs an account works until its email address is
 * confirmed, for every role; only the confirm page itself (and what it needs:
 * a new link, a corrected address) opts out with `allowUnconfirmed`.
 */
export function signedInGate(session: { emailConfirmed: boolean } | null, options: { allowUnconfirmed?: boolean } = {}): string | null {
  if (!session) return "/login";
  if (!session.emailConfirmed && !options.allowUnconfirmed) return CHECK_EMAIL_PATH;
  return null;
}
