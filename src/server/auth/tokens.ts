import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe. Goes in the cookie; never stored as-is. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores, so a leaked DB row can't be replayed as a cookie. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
