import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeStudent, resetDb } from "./factories";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));

const { getBrowserTimeZone, getViewerTimeZone } = await import("@/server/auth/viewer");
const { startSession } = await import("@/server/auth/session");
const { db } = await import("@/server/db");

beforeEach(async () => {
  jar.clear();
  await resetDb();
});

describe("viewer time zone", () => {
  it("falls back to UTC with nothing to go on", async () => {
    expect(await getBrowserTimeZone()).toBeUndefined();
    expect(await getViewerTimeZone()).toBe("UTC");
  });

  it("uses the browser's zone from the cookie, ignoring junk", async () => {
    jar.set("st_tz", encodeURIComponent("Africa/Lagos"));
    expect(await getBrowserTimeZone()).toBe("Africa/Lagos");
    jar.set("st_tz", "%E0%A4%A");
    expect(await getBrowserTimeZone()).toBeUndefined();
  });

  it("prefers the account setting over the browser", async () => {
    const student = await makeStudent();
    await db.user.update({ where: { id: student.id }, data: { timeZone: "Europe/London" } });
    await startSession(student.id);
    jar.set("st_tz", encodeURIComponent("Africa/Lagos"));
    expect(await getViewerTimeZone()).toBe("Europe/London");
  });
});
