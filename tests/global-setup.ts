import { execSync } from "node:child_process";

/** A separate database so tests never touch development data. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/pstsamteach_test";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/**
 * Bring the test database up to date with the migrations before the suite runs.
 * Nothing is dropped here: each test clears its own rows with resetDb().
 */
export default function setup() {
  // resetDb() deletes every row, so only a local database is allowed unless explicitly overridden.
  if (!LOCAL_HOSTS.includes(new URL(TEST_DATABASE_URL).hostname) && process.env.TEST_ALLOW_REMOTE_DB !== "1") {
    throw new Error("TEST_DATABASE_URL must point at a local database because tests delete every row. Set TEST_ALLOW_REMOTE_DB=1 to override.");
  }
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
}
