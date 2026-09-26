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
