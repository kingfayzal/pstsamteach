import { beforeEach, describe, expect, it } from "vitest";
import { parseDirectoryFilters } from "@/lib/teacher-directory";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { listDirectory } from "@/server/queries/teachers";
import { authenticate } from "@/server/services/accounts";
import { addDemoData, DEMO_STUDENTS, DEMO_SUBJECTS, DEMO_TEACHERS, removeDemoData } from "../../scripts/demo-data";
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

  it("keeps a demo subject that someone else's course still uses", async () => {
    await addDemoData(db, await hashPassword(PASSWORD));
    const science = await db.subject.findUniqueOrThrow({ where: { slug: "d-science" } });
    const realTeacher = await makeTeacher();
    await makeCourse(realTeacher.id, science.id);

    expect(await removeDemoData(db)).toEqual({ users: 6, subjects: 2, keptSubjects: ["D-Science"] });
    expect(await db.course.count()).toBe(1);
  });
});
