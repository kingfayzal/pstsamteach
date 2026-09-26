import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeStudent, makeTeacher, makeUser, resetDb } from "./factories";

// A cookie jar standing in for next/headers, and a redirect that throws like Next's does.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

const session = await import("@/server/auth/session");
const { db } = await import("@/server/db");

beforeEach(async () => {
  jar.clear();
  await resetDb();
});

describe("cookie sessions", () => {
  it("starts a session, resolves the user, and ends it", async () => {
    const student = await makeStudent();
    await session.startSession(student.id);
    expect(jar.get(session.SESSION_COOKIE)).toBeTruthy();
    expect(await session.getCurrentUser()).toMatchObject({ id: student.id });

    await session.endSession();
    expect(jar.has(session.SESSION_COOKIE)).toBe(false);
    expect(await db.session.count()).toBe(0);
  });

  it("returns nobody without a cookie, and requireUser redirects to log in", async () => {
    expect(await session.getCurrentUser()).toBeNull();
    await expect(session.requireUser()).rejects.toThrow("REDIRECT:/login");
    await expect(session.endSession()).resolves.toBeUndefined();
  });

  it("sends people with the wrong role to their own area", async () => {
    const student = await makeStudent();
    await session.startSession(student.id);
    await expect(session.requireRole("ADMIN")).rejects.toThrow("REDIRECT:/learn");
    await expect(session.requireRole("STUDENT")).resolves.toMatchObject({ id: student.id });
  });

  it("keeps pending teachers on their application page", async () => {
    const pending = await makeUser({ role: "TEACHER", status: "PENDING" });
    await session.startSession(pending.id);
    await expect(session.requireRole("TEACHER")).rejects.toThrow("REDIRECT:/teach/pending");
    await expect(session.requireRole("TEACHER", { allowPending: true })).resolves.toMatchObject({ id: pending.id });
  });

  it("signs out other devices but keeps this one", async () => {
    const teacher = await makeTeacher();
    await session.startSession(teacher.id);
    await db.session.create({ data: { id: "other-device", userId: teacher.id, expiresAt: new Date(Date.now() + 60_000) } });
    await session.endOtherSessions(teacher.id);
    expect(await db.session.count({ where: { userId: teacher.id } })).toBe(1);
    expect(await session.getCurrentUser()).toMatchObject({ id: teacher.id });
  });
});
