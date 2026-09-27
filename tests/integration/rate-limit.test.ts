import { beforeEach, describe, expect, it } from "vitest";
import { createRateLimiter } from "@/server/auth/rate-limit";
import { db } from "@/server/db";

beforeEach(async () => {
  await db.rateLimit.deleteMany();
});

describe("createRateLimiter (Postgres)", () => {
  it("allows up to the limit in a window, then blocks until it passes", async () => {
    const limiter = createRateLimiter({ name: "test", limit: 2, windowMs: 1_000 });
    const t0 = new Date("2026-09-27T12:00:00.000Z");
    expect((await limiter.hit("k", t0)).allowed).toBe(true);
    expect(await limiter.hit("k", new Date(t0.getTime() + 100))).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = await limiter.hit("k", new Date(t0.getTime() + 200));
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, retryAfterMs: 800 });
    expect((await limiter.hit("k", new Date(t0.getTime() + 1_001))).allowed).toBe(true);
  });

  it("tracks keys and limiter names independently, and can reset", async () => {
    const a = createRateLimiter({ name: "a", limit: 1, windowMs: 60_000 });
    const b = createRateLimiter({ name: "b", limit: 1, windowMs: 60_000 });
    expect((await a.hit("same")).allowed).toBe(true);
    expect((await b.hit("same")).allowed).toBe(true);
    expect((await a.hit("other")).allowed).toBe(true);
    expect((await a.hit("same")).allowed).toBe(false);
    await a.reset("same");
    expect((await a.hit("same")).allowed).toBe(true);
  });

  it("counts correctly under concurrent hits", async () => {
    const limiter = createRateLimiter({ name: "burst", limit: 5, windowMs: 60_000 });
    const results = await Promise.all(Array.from({ length: 12 }, () => limiter.hit("ip")));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "burst:ip" } })).count).toBe(12);
  });
});
