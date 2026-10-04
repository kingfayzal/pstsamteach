import { beforeEach, describe, expect, it } from "vitest";
import { parseDirectoryFilters } from "@/lib/teacher-directory";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { listDirectory } from "@/server/queries/teachers";
import { authenticate } from "@/server/services/accounts";
import {
  addDemoData,
  addDemoLogins,
  DEMO_LOGINS,
  DEMO_STUDENTS,
  DEMO_SUBJECTS,
  DEMO_TEACHERS,
  demoDataPresent,
  removeDemoData,
  syncDemoData,
} from "../../scripts/demo-data";
import { makeCourse, makeStudent, makeSubject, makeTeacher, resetDb } from "./factories";

beforeEach(resetDb);

const PASSWORD = "demo-password-for-tests-1";
const LAGOS = { timeZone: "Africa/Lagos" };

// Dozens of writes plus password hashing per test; slower than the default timeout on a small database.
describe("demo data", { timeout: 30_000 }, () => {
  it("adds three D- subjects, teachers and students, and lists the teachers in the directory", async () => {
    await addDemoData(db, await hashPassword(PASSWORD));

    const subjects = await db.subject.findMany({ orderBy: { position: "asc" }, select: { name: true, topics: { select: { id: true } } } });
    expect(subjects.map((s) => s.name)).toEqual(["D-Science", "D-History", "D-Geography"]);
    expect(subjects.every((s) => s.topics.length === 3)).toBe(true);

    const people = await db.user.findMany({ select: { name: true, role: true, status: true } });
    expect(people.filter((p) => p.role === "TEACHER").map((p) => p.name).sort()).toEqual(["D-Amara Eze", "D-Mark Buck", "D-Tunde Bakare"]);
    expect(people.filter((p) => p.role === "STUDENT").map((p) => p.name).sort()).toEqual(["D-Chioma Okeke", "D-Liam Carter", "D-Zainab Bello"]);
    expect(people.every((p) => p.status === "ACTIVE" && p.name.startsWith("D-"))).toBe(true);

    const directory = await listDirectory(parseDirectoryFilters({}), LAGOS);
    expect(directory).toHaveLength(3);
    const science = await listDirectory(parseDirectoryFilters({ subject: "d-science" }), LAGOS);
    expect(science.map((row) => row.headline)).toEqual([DEMO_TEACHERS[0].headline]);

    for (const person of [DEMO_TEACHERS[0], DEMO_STUDENTS[0]]) {
      expect((await authenticate({ email: person.email, password: PASSWORD })).ok).toBe(true);
    }
  });

  it("can run again without duplicating anything, switching every account to the new password", async () => {
    await addDemoData(db, await hashPassword(PASSWORD));
    const student = await db.user.findUniqueOrThrow({ where: { email: DEMO_STUDENTS[1].email } });
    await db.session.create({ data: { id: "demo-session", userId: student.id, expiresAt: new Date(Date.now() + 60_000) } });

    await addDemoData(db, await hashPassword("a-different-password-2"));

    expect(await db.subject.count()).toBe(DEMO_SUBJECTS.length);
    expect(await db.topic.count()).toBe(9);
    expect(await db.user.count()).toBe(DEMO_TEACHERS.length + DEMO_STUDENTS.length);
    expect(await db.teacherTopic.count()).toBe(9);
    expect(await db.session.count()).toBe(0);
    expect((await authenticate({ email: DEMO_STUDENTS[1].email, password: PASSWORD })).ok).toBe(false);
    expect((await authenticate({ email: DEMO_STUDENTS[1].email, password: "a-different-password-2" })).ok).toBe(true);
  });

  it("removes exactly the demo records, including demo teachers' courses", async () => {
    const realSubject = await makeSubject({ name: "English" });
    const realTeacher = await makeTeacher();
    const realStudent = await makeStudent();
    await addDemoData(db, await hashPassword(PASSWORD));
    const markBuck = await db.user.findUniqueOrThrow({ where: { email: DEMO_TEACHERS[0].email } });
    await makeCourse(markBuck.id, realSubject.id);

    expect(await removeDemoData(db)).toEqual({ users: 6, subjects: 3, keptSubjects: [] });

    expect((await db.user.findMany({ select: { id: true } })).map((u) => u.id).sort()).toEqual([realTeacher.id, realStudent.id].sort());
    expect((await db.subject.findMany({ select: { id: true } })).map((s) => s.id)).toEqual([realSubject.id]);
    expect(await db.course.count()).toBe(0);
    expect(await removeDemoData(db)).toEqual({ users: 0, subjects: 0, keptSubjects: [] });
  });

  it("syncs to the production switch: adds once, leaves it alone after that, removes when off", async () => {
    let hashed = 0;
    const makeHash = async () => {
      hashed += 1;
      return hashPassword(PASSWORD);
    };
    expect(await demoDataPresent(db)).toBe(false);
    expect(await syncDemoData(db, true, makeHash)).toEqual({ action: "added" });
    expect(await demoDataPresent(db)).toBe(true);

    // Edits made while demoing survive the next deploy, and no new password is made.
    const mark = await db.user.findUniqueOrThrow({ where: { email: DEMO_TEACHERS[0].email } });
    await db.teacherProfile.update({ where: { userId: mark.id }, data: { headline: "Edited during a demo" } });
    expect(await syncDemoData(db, true, makeHash)).toEqual({ action: "kept" });
    expect(hashed).toBe(1);
    expect((await db.teacherProfile.findUniqueOrThrow({ where: { userId: mark.id } })).headline).toBe("Edited during a demo");

    expect(await syncDemoData(db, false, makeHash)).toEqual({ action: "removed", users: 6, subjects: 3, keptSubjects: [] });
    expect(await demoDataPresent(db)).toBe(false);
    expect(await syncDemoData(db, false, makeHash)).toEqual({ action: "removed", users: 0, subjects: 0, keptSubjects: [] });
  });

  it("keeps a demo subject that someone else's course still uses", async () => {
    await addDemoData(db, await hashPassword(PASSWORD));
    const science = await db.subject.findUniqueOrThrow({ where: { slug: "d-science" } });
    const realTeacher = await makeTeacher();
    await makeCourse(realTeacher.id, science.id);

    expect(await removeDemoData(db)).toEqual({ users: 6, subjects: 2, keptSubjects: ["D-Science"] });
    expect(await db.course.count()).toBe(1);
  });
});

describe("demo logins", { timeout: 30_000 }, () => {
  const emails = DEMO_LOGINS.map((login) => login.email);

  it("adds a student, an admin and a listed teacher, who all sign in with the shared password", async () => {
    await addDemoLogins(db, await hashPassword(PASSWORD), { admin: true });

    const people = await db.user.findMany({ where: { email: { in: emails } }, orderBy: { email: "asc" }, select: { email: true, role: true, status: true } });
    expect(people.map((p) => [p.email, p.role])).toEqual([
      ["admin@xceldemo.com", "ADMIN"],
      ["student@xceldemo.com", "STUDENT"],
      ["teacher@xceldemo.com", "TEACHER"],
    ]);
    expect(people.every((p) => p.status === "ACTIVE")).toBe(true);
    for (const email of emails) {
      expect((await authenticate({ email, password: PASSWORD })).ok).toBe(true);
    }
    expect(await demoDataPresent(db)).toBe(true);

    // The teacher teaches every demo subject, so the demo student can find and request them.
    for (const subject of DEMO_SUBJECTS) {
      const listed = await listDirectory(parseDirectoryFilters({ subject: subject.slug }), LAGOS);
      expect(listed.map((row) => row.name)).toEqual(["Demo Teacher"]);
    }
  });

  it("leaves the admin out for the live site, removing one made earlier", async () => {
    await addDemoLogins(db, await hashPassword(PASSWORD), { admin: true });
    await addDemoLogins(db, await hashPassword(PASSWORD), { admin: false });

    expect((await db.user.findMany({ orderBy: { email: "asc" }, select: { email: true } })).map((u) => u.email)).toEqual([
      "student@xceldemo.com",
      "teacher@xceldemo.com",
    ]);
  });

  it("can run again without duplicating anything, switching to the new password", async () => {
    await addDemoLogins(db, await hashPassword(PASSWORD), { admin: true });
    const student = await db.user.findUniqueOrThrow({ where: { email: "student@xceldemo.com" } });
    await db.session.create({ data: { id: "demo-login-session", userId: student.id, expiresAt: new Date(Date.now() + 60_000) } });

    await addDemoLogins(db, await hashPassword("a-different-password-2"), { admin: true });

    expect(await db.user.count()).toBe(3);
    expect(await db.subject.count()).toBe(DEMO_SUBJECTS.length);
    expect(await db.teacherProfile.count()).toBe(1);
    expect(await db.teacherTopic.count()).toBe(9);
    expect(await db.session.count()).toBe(0);
    expect((await authenticate({ email: "student@xceldemo.com", password: PASSWORD })).ok).toBe(false);
    expect((await authenticate({ email: "student@xceldemo.com", password: "a-different-password-2" })).ok).toBe(true);
  });

  it("are removed with the rest of the demo data", async () => {
    await addDemoData(db, await hashPassword(PASSWORD));
    await addDemoLogins(db, await hashPassword(PASSWORD), { admin: true });

    expect(await removeDemoData(db)).toEqual({ users: 9, subjects: 3, keptSubjects: [] });
    expect(await db.user.count()).toBe(0);
  });
});
