/**
 * Create the first admin (or promote an existing account) on any database,
 * including production:
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npm run create-admin
 *
 * With DATABASE_URL pointing at the target database. The password comes from
 * ADMIN_PASSWORD, or is generated and printed once. Change it after signing in.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/server/auth/password-core";
import { createPrismaClient } from "../src/server/db-client";
import { emailSchema, newPasswordSchema } from "../src/lib/validation/auth";

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL ?? "");
  const name = (process.env.ADMIN_NAME ?? "").trim() || "Platform Admin";
  const generated = !process.env.ADMIN_PASSWORD;
  const password = newPasswordSchema.parse(process.env.ADMIN_PASSWORD ?? `admin-${randomBytes(9).toString("base64url")}-1`);

  const db = createPrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "ACTIVE" } });
      await db.session.deleteMany({ where: { userId: existing.id } });
      console.log(`Promoted ${email} to admin. Their existing password still works; they need to sign in again.`);
    } else {
      await db.user.create({ data: { email, name, role: "ADMIN", status: "ACTIVE", passwordHash: await hashPassword(password) } });
      console.log(`Created admin ${email}.`);
      console.log(generated ? `Temporary password (shown once, not saved anywhere): ${password}` : "Password: the value of ADMIN_PASSWORD.");
      console.log("Sign in and change it from the Account page.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
