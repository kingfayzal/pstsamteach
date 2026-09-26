import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export const TEST_DATABASE_URL = "file:./test.db";

/** Build a fresh SQLite database from the migrations before the suite runs. */
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`test.db${suffix}`, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
