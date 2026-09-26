import "server-only";
import {
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  signupSchema,
  teacherApplicationSchema,
} from "@/lib/validation/auth";
import { getDummyHash, hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { type Actor, fail, invalid, ok, type ServiceResult } from "./result";

export const actorSelect = { id: true, name: true, email: true, role: true, status: true } as const;

const EMAIL_TAKEN = "An account with that email already exists. Log in instead.";
const BAD_CREDENTIALS = "That email and password don't match an account.";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

async function emailTaken(email: string): Promise<boolean> {
  return (await db.user.count({ where: { email } })) > 0;
}

export async function registerStudent(input: unknown): Promise<ServiceResult<Actor>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password } = parsed.data;
  if (await emailTaken(email)) return fail("CONFLICT", EMAIL_TAKEN, { email: [EMAIL_TAKEN] });
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: "STUDENT", status: "ACTIVE" },
      select: actorSelect,
    });
    return ok(user);
  } catch (error) {
    if (isUniqueViolation(error)) return fail("CONFLICT", EMAIL_TAKEN, { email: [EMAIL_TAKEN] });
    throw error;
  }
}

export async function applyToTeach(input: unknown): Promise<ServiceResult<Actor>> {
  const parsed = teacherApplicationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password, subjectId, applicationNote } = parsed.data;

  const subject = await db.subject.findFirst({ where: { id: subjectId, isActive: true }, select: { id: true } });
  if (!subject) {
    return fail("INVALID", "Choose one of the listed subjects.", { subjectId: ["Choose one of the listed subjects."] });
  }
  if (await emailTaken(email)) return fail("CONFLICT", EMAIL_TAKEN, { email: [EMAIL_TAKEN] });

  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "TEACHER",
        status: "PENDING",
        applicationNote,
        applicationSubjectId: subject.id,
      },
      select: actorSelect,
    });
    return ok(user);
  } catch (error) {
    if (isUniqueViolation(error)) return fail("CONFLICT", EMAIL_TAKEN, { email: [EMAIL_TAKEN] });
    throw error;
  }
}

export async function authenticate(input: unknown): Promise<ServiceResult<Actor>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email }, select: { ...actorSelect, passwordHash: true } });
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return fail("INVALID", BAD_CREDENTIALS);
  }
  if (!(await verifyPassword(password, user.passwordHash))) return fail("INVALID", BAD_CREDENTIALS);
  if (user.status === "SUSPENDED") {
    return fail("FORBIDDEN", "This account is suspended. Contact the platform team to restore access.");
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const { passwordHash: _omit, ...actor } = user;
  return ok(actor);
}

export async function updateProfile(actor: Actor, input: unknown): Promise<ServiceResult<null>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.user.update({ where: { id: actor.id }, data: parsed.data });
  return ok(null);
}

export async function changePassword(actor: Actor, input: unknown): Promise<ServiceResult<null>> {
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    const message = "Your current password isn't right.";
    return fail("INVALID", message, { currentPassword: [message] });
  }
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
  return ok(null);
}
