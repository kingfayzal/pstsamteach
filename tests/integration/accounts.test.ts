import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  applyToTeach,
  authenticate,
  changePassword,
  registerStudent,
  updateProfile,
} from "@/server/services/accounts";
import {
  createSessionRecord,
  findActorBySessionToken,
  revokeSessionToken,
  revokeUserSessions,
} from "@/server/auth/session-store";
import { makeStudent, makeSubject, makeUser, resetDb, TEST_PASSWORD } from "./factories";

beforeEach(resetDb);

const newPassword = () => `np-${Math.random().toString(36).slice(2)}-7`;

describe("registerStudent", () => {
  it("creates an active student with a hashed password", async () => {
    const password = newPassword();
    const result = await registerStudent({ name: "Ada Obi", email: "ADA@example.com", password });
    expect(result.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    expect(user).toMatchObject({ role: "STUDENT", status: "ACTIVE" });
    expect(user.passwordHash).not.toContain(password);
  });

  it("rejects a duplicate email", async () => {
    await makeUser({ email: "taken@example.com" });
    const result = await registerStudent({ name: "Ada", email: "taken@example.com", password: newPassword() });
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("returns field errors for invalid input", async () => {
    const result = await registerStudent({ name: "", email: "nope", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors ?? {})).toEqual(expect.arrayContaining(["name", "email", "password"]));
    }
  });
});

describe("applyToTeach", () => {
  it("creates a pending teacher linked to the chosen subject", async () => {
    const subject = await makeSubject();
    const result = await applyToTeach({
      name: "Tunde Bello",
      email: "tunde@example.com",
      password: newPassword(),
      subjectId: subject.id,
      applicationNote: "I have taught secondary maths for eight years and tutor exam classes.",
    });
    expect(result).toMatchObject({ ok: true, data: { role: "TEACHER", status: "PENDING" } });
    const user = await db.user.findUniqueOrThrow({ where: { email: "tunde@example.com" } });
    expect(user.applicationSubjectId).toBe(subject.id);
  });

  it("refuses an inactive subject", async () => {
    const subject = await makeSubject({ isActive: false });
    const result = await applyToTeach({
      name: "Tunde Bello",
      email: "tunde@example.com",
      password: newPassword(),
      subjectId: subject.id,
      applicationNote: "I have taught secondary maths for eight years and tutor exam classes.",
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
  });
});

describe("authenticate", () => {
  it("signs in with the right password and records the login", async () => {
    const user = await makeStudent();
    const result = await authenticate({ email: user.email, password: TEST_PASSWORD });
    expect(result).toMatchObject({ ok: true, data: { id: user.id } });
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lastLoginAt).not.toBeNull();
  });

  it("gives the same message for a wrong password and an unknown email", async () => {
    const user = await makeStudent();
    const wrong = await authenticate({ email: user.email, password: "wrong-password-1" });
    const unknown = await authenticate({ email: "ghost@example.com", password: "wrong-password-1" });
    expect(wrong.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    if (!wrong.ok && !unknown.ok) expect(wrong.message).toBe(unknown.message);
  });

  it("blocks suspended accounts", async () => {
    const user = await makeUser({ status: "SUSPENDED" });
    const result = await authenticate({ email: user.email, password: TEST_PASSWORD });
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("profile and password", () => {
  it("updates name and bio", async () => {
    const user = await makeStudent();
    const result = await updateProfile(user, { name: "New Name", bio: "Nursing student in year two." });
    expect(result.ok).toBe(true);
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row).toMatchObject({ name: "New Name", bio: "Nursing student in year two." });
  });

  it("changes the password only with the current one", async () => {
    const user = await makeStudent();
    const next = newPassword();
    const bad = await changePassword(user, { currentPassword: "nope-123", newPassword: next, confirmPassword: next });
    expect(bad).toMatchObject({ ok: false, code: "INVALID" });

    const good = await changePassword(user, { currentPassword: TEST_PASSWORD, newPassword: next, confirmPassword: next });
    expect(good.ok).toBe(true);
    expect((await authenticate({ email: user.email, password: next })).ok).toBe(true);
  });
});

describe("session store", () => {
  it("resolves a token to its user and revokes it", async () => {
    const user = await makeStudent();
    const { token } = await createSessionRecord(user.id);
    expect(await findActorBySessionToken(token)).toMatchObject({ id: user.id });
    await revokeSessionToken(token);
    expect(await findActorBySessionToken(token)).toBeNull();
  });

  it("drops expired sessions", async () => {
    const user = await makeStudent();
    const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { token } = await createSessionRecord(user.id, past);
    expect(await findActorBySessionToken(token)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("returns nothing for suspended users", async () => {
    const user = await makeStudent();
    const { token } = await createSessionRecord(user.id);
    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    expect(await findActorBySessionToken(token)).toBeNull();
  });

  it("revokes every session but the current one", async () => {
    const user = await makeStudent();
    const a = await createSessionRecord(user.id);
    const b = await createSessionRecord(user.id);
    await revokeUserSessions(user.id, a.token);
    expect(await findActorBySessionToken(a.token)).not.toBeNull();
    expect(await findActorBySessionToken(b.token)).toBeNull();
    expect(await findActorBySessionToken("")).toBeNull();
  });
});
