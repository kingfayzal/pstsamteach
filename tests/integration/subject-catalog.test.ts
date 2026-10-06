import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { db } from "@/server/db";
import { CATALOG } from "../../prisma/seed-content/catalog";
import { resetDb } from "./factories";

/**
 * The real migration file, run exactly as a deploy runs it. It's one static DO
 * block from the repo, not SQL built from input, so it goes through as written.
 */
const MIGRATION = readFileSync(new URL("../../prisma/migrations/20261006120000_subject_catalog/migration.sql", import.meta.url), "utf8");
const runMigration = () => db.$executeRawUnsafe(MIGRATION);

beforeEach(resetDb);

const subjectsInDb = () =>
  db.subject.findMany({
    orderBy: { position: "asc" },
    select: { slug: true, name: true, tagline: true, description: true, color: true, isActive: true, topics: { orderBy: { position: "asc" }, select: { name: true, slug: true } } },
  });

describe("the subject catalog migration", () => {
  it("adds every catalog subject and its topics, in order, to an empty database", async () => {
    await runMigration();
    const subjects = await subjectsInDb();
    expect(subjects.map((s) => s.slug)).toEqual(CATALOG.map((s) => s.slug));
    for (const [i, expected] of CATALOG.entries()) {
      expect(subjects[i]).toMatchObject({ name: expected.name, tagline: expected.tagline, description: expected.description, color: expected.color, isActive: true });
      expect(subjects[i].topics.map((t) => t.name)).toEqual([...expected.topics]);
      // Same slugs the app makes, so topic links and filters work for them.
      expect(subjects[i].topics.map((t) => t.slug)).toEqual(expected.topics.map((name) => slugify(name, "topic")));
    }
  });

  it("keeps an existing subject's details and topics, adding only what's missing after them", async () => {
    const maths = await db.subject.create({
      data: { slug: "mathematics", name: "Mathematics", tagline: "Set by an admin", description: "Kept as it is.", color: "#123456", position: 3 },
    });
    await db.topic.createMany({
      data: [
        { subjectId: maths.id, name: "Geometry", slug: "geometry", position: 1 },
        { subjectId: maths.id, name: "Exam technique", slug: "exam-technique", position: 2 },
      ],
    });

    await runMigration();
    const subjects = await subjectsInDb();
    const kept = subjects.find((s) => s.slug === "mathematics");
    expect(kept).toMatchObject({ tagline: "Set by an admin", description: "Kept as it is.", color: "#123456" });
    const missing = CATALOG[0].topics.filter((name) => name !== "Geometry");
    expect(kept?.topics.map((t) => t.name)).toEqual(["Geometry", "Exam technique", ...missing]);
    // New subjects go after the existing one.
    expect(subjects.map((s) => s.slug)).toEqual(["mathematics", "english", "vocational-development", "test-preparation"]);
  });

  it("finds an existing subject by name when its slug differs", async () => {
    await db.subject.create({ data: { slug: "english-language", name: "English", tagline: "t", description: "d", color: "#B3374A", position: 1 } });
    await runMigration();
    expect(await db.subject.count({ where: { name: "English" } })).toBe(1);
    expect(await db.subject.count({ where: { slug: "english" } })).toBe(0);
    const english = await db.subject.findUniqueOrThrow({ where: { slug: "english-language" }, select: { _count: { select: { topics: true } } } });
    expect(english._count.topics).toBe(CATALOG[1].topics.length);
  });

  it("changes nothing when it runs again", async () => {
    await runMigration();
    const first = await subjectsInDb();
    await runMigration();
    expect(await subjectsInDb()).toEqual(first);
  });
});
