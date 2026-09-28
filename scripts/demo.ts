/**
 * Add or remove the "D-" demo subjects, teachers and students on any database,
 * including production:
 *
 *   npm run demo:add      (all demo accounts share one password, printed once,
 *                          or the value of DEMO_PASSWORD)
 *   npm run demo:remove
 *
 * With DATABASE_URL pointing at the target database. Only the records listed
 * in scripts/demo-data.ts are touched; running `add` again updates them.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { newPasswordSchema } from "../src/lib/validation/auth";
import { hashPassword } from "../src/server/auth/password-core";
import { createPrismaClient } from "../src/server/db-client";
import { addDemoData, DEMO_STUDENTS, DEMO_SUBJECTS, DEMO_TEACHERS, removeDemoData } from "./demo-data";

async function main() {
  const command = process.argv[2];
  if (command !== "add" && command !== "remove") {
    throw new Error("Use `npm run demo:add` or `npm run demo:remove`.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  console.log(`Database: ${new URL(url).host}`);

  const db = createPrismaClient(url);
  try {
    if (command === "remove") {
      const removed = await removeDemoData(db);
      console.log(`Removed ${removed.users} demo accounts and ${removed.subjects} demo subjects.`);
      if (removed.keptSubjects.length > 0) {
        console.log(`Kept ${removed.keptSubjects.join(", ")}: other teachers' courses still use them. Move or delete those courses, then run this again.`);
      }
      return;
    }

    const generated = !process.env.DEMO_PASSWORD;
    const password = newPasswordSchema.parse(process.env.DEMO_PASSWORD ?? `demo-${randomBytes(9).toString("base64url")}-1`);
    await addDemoData(db, await hashPassword(password));
    console.log(`Demo subjects: ${DEMO_SUBJECTS.map((subject) => subject.name).join(", ")}`);
    console.log("Demo teachers:");
    for (const teacher of DEMO_TEACHERS) console.log(`  ${teacher.name}  ${teacher.email}`);
    console.log("Demo students:");
    for (const student of DEMO_STUDENTS) console.log(`  ${student.name}  ${student.email}`);
    console.log(generated ? `Password for every demo account (shown once, not saved anywhere): ${password}` : "Password for every demo account: the value of DEMO_PASSWORD.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
