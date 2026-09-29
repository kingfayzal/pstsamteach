/**
 * Add or remove the "D-" demo subjects, teachers and students on any database,
 * including production:
 *
 *   npm run demo:add      (all demo accounts share one password, printed once,
 *                          or the value of DEMO_PASSWORD)
 *   npm run demo:remove
 *
 * With DATABASE_URL pointing at the target database. Only the records listed
 * in scripts/demo-data.ts are touched; running `add` again resets them.
 *
 * `tsx scripts/demo.ts sync` is what production deploys run: it applies the
 * DEMO_DATA_ON_PRODUCTION switch in scripts/demo-data.ts.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { newPasswordSchema } from "../src/lib/validation/auth";
import { hashPassword } from "../src/server/auth/password-core";
import { createPrismaClient } from "../src/server/db-client";
import {
  addDemoData,
  DEMO_DATA_ON_PRODUCTION,
  DEMO_STUDENTS,
  DEMO_SUBJECTS,
  DEMO_TEACHERS,
  removeDemoData,
  syncDemoData,
} from "./demo-data";

function demoPassword() {
  const generated = !process.env.DEMO_PASSWORD;
  const password = newPasswordSchema.parse(process.env.DEMO_PASSWORD ?? `demo-${randomBytes(9).toString("base64url")}-1`);
  return { password, generated };
}

function printAdded({ password, generated }: { password: string; generated: boolean }) {
  console.log(`Demo subjects: ${DEMO_SUBJECTS.map((subject) => subject.name).join(", ")}`);
  console.log("Demo teachers:");
  for (const teacher of DEMO_TEACHERS) console.log(`  ${teacher.name}  ${teacher.email}`);
  console.log("Demo students:");
  for (const student of DEMO_STUDENTS) console.log(`  ${student.name}  ${student.email}`);
  console.log(generated ? `Password for every demo account (shown once, not saved anywhere): ${password}` : "Password for every demo account: the value of DEMO_PASSWORD.");
}

function printRemoved(removed: { users: number; subjects: number; keptSubjects: string[] }) {
  console.log(`Removed ${removed.users} demo accounts and ${removed.subjects} demo subjects.`);
  if (removed.keptSubjects.length > 0) {
    console.log(`Kept ${removed.keptSubjects.join(", ")}: other teachers' courses still use them. Move or delete those courses, then run this again.`);
  }
}

async function main() {
  const command = process.argv[2];
  if (command !== "add" && command !== "remove" && command !== "sync") {
    throw new Error("Use `npm run demo:add` or `npm run demo:remove`.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  console.log(`Database: ${new URL(url).host}`);

  const db = createPrismaClient(url);
  try {
    if (command === "remove") {
      printRemoved(await removeDemoData(db));
    } else if (command === "add") {
      const secret = demoPassword();
      await addDemoData(db, await hashPassword(secret.password));
      printAdded(secret);
    } else {
      const secret = demoPassword();
      const result = await syncDemoData(db, DEMO_DATA_ON_PRODUCTION, () => hashPassword(secret.password));
      if (result.action === "added") printAdded(secret);
      if (result.action === "kept") console.log("Demo data is already here; leaving it as it is.");
      if (result.action === "removed") printRemoved(result);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
