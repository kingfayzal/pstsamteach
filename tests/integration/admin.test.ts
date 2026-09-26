import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createSessionRecord, findActorBySessionToken } from "@/server/auth/session-store";
import {
  approveTeacher,
  changeUserRole,
  createSubject,
  declineTeacher,
  reactivateUser,
  setSubjectActive,
  suspendUser,
  updateSubject,
} from "@/server/services/admin";
import { deleteAnnouncement, postCourseAnnouncement, postPlatformAnnouncement } from "@/server/services/announcements";
import { makeAdmin, makeCourse, makeStudent, makeSubject, makeTeacher, makeUser, resetDb } from "./factories";

beforeEach(resetDb);

describe("teacher applications", () => {
  it("approves a pending teacher", async () => {
    const [admin, applicant] = await Promise.all([makeAdmin(), makeUser({ role: "TEACHER", status: "PENDING" })]);
    expect((await approveTeacher(admin, applicant.id)).ok).toBe(true);
    expect(await db.user.findUniqueOrThrow({ where: { id: applicant.id } })).toMatchObject({ status: "ACTIVE", role: "TEACHER" });
    expect(await approveTeacher(admin, applicant.id)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("declines into a student account", async () => {
    const [admin, applicant] = await Promise.all([makeAdmin(), makeUser({ role: "TEACHER", status: "PENDING" })]);
    expect((await declineTeacher(admin, applicant.id)).ok).toBe(true);
    expect(await db.user.findUniqueOrThrow({ where: { id: applicant.id } })).toMatchObject({ status: "ACTIVE", role: "STUDENT" });
  });

  it("is admin-only", async () => {
    const [teacher, applicant] = await Promise.all([makeTeacher(), makeUser({ role: "TEACHER", status: "PENDING" })]);
    expect(await approveTeacher(teacher, applicant.id)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("suspension", () => {
  it("suspends, ends sessions, and reactivates", async () => {
    const [admin, student] = await Promise.all([makeAdmin(), makeStudent()]);
    const { token } = await createSessionRecord(student.id);
    expect((await suspendUser(admin, student.id)).ok).toBe(true);
    expect(await findActorBySessionToken(token)).toBeNull();
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
    expect((await suspendUser(admin, student.id)).ok).toBe(true); // idempotent

    expect((await reactivateUser(admin, student.id)).ok).toBe(true);
    expect(await reactivateUser(admin, student.id)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("stops admins suspending themselves", async () => {
    const admin = await makeAdmin();
    expect(await suspendUser(admin, admin.id)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await suspendUser(admin, "missing")).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("changeUserRole", () => {
  it("changes a role and signs the person out", async () => {
    const [admin, student] = await Promise.all([makeAdmin(), makeStudent()]);
    await createSessionRecord(student.id);
    expect((await changeUserRole(admin, student.id, "TEACHER")).ok).toBe(true);
    expect(await db.user.findUniqueOrThrow({ where: { id: student.id } })).toMatchObject({ role: "TEACHER" });
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
  });

  it("won't strip a teacher who still owns courses, or accept junk roles", async () => {
    const [admin, teacher, subject] = await Promise.all([makeAdmin(), makeTeacher(), makeSubject()]);
    await makeCourse(teacher.id, subject.id);
    expect(await changeUserRole(admin, teacher.id, "STUDENT")).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await changeUserRole(admin, teacher.id, "OWNER")).toMatchObject({ ok: false, code: "INVALID" });
    expect((await changeUserRole(admin, teacher.id, "TEACHER")).ok).toBe(true); // no-op
  });
});

describe("subjects", () => {
  it("adds, edits and closes subjects", async () => {
    const admin = await makeAdmin();
    const created = await createSubject(admin, { name: "Biology", tagline: "Cells to systems", description: "Life science.", color: "#0a7684" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const row = await db.subject.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(row).toMatchObject({ slug: "biology", color: "#0A7684" });

    expect(await createSubject(admin, { name: "Biology", tagline: "Again", description: "Duplicate.", color: "#000000" })).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect((await updateSubject(admin, created.data.id, { name: "Life Science", tagline: "Cells", description: "Life science.", color: "#123456" })).ok).toBe(true);
    expect((await setSubjectActive(admin, created.data.id, false)).ok).toBe(true);
    expect(await db.subject.findUniqueOrThrow({ where: { id: created.data.id } })).toMatchObject({ name: "Life Science", isActive: false });
  });

  it("is admin-only and validates colours", async () => {
    const [admin, teacher] = await Promise.all([makeAdmin(), makeTeacher()]);
    expect(await createSubject(teacher, {})).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await createSubject(admin, { name: "Art", tagline: "Draw", description: "Drawing course.", color: "blue" })).toMatchObject({
      ok: false,
      code: "INVALID",
    });
    expect(await setSubjectActive(admin, "missing", true)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("announcements", () => {
  it("lets teachers post to their course and admins post platform-wide", async () => {
    const [admin, teacher, other, subject] = await Promise.all([makeAdmin(), makeTeacher(), makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id, { status: "PUBLISHED" });

    const courseNote = await postCourseAnnouncement(teacher, course.id, { title: "Quiz moved", body: "The quiz is now open until Friday." });
    expect(courseNote.ok).toBe(true);
    expect(await postCourseAnnouncement(other, course.id, { title: "Nope", body: "Not my course." })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });

    const platform = await postPlatformAnnouncement(admin, { title: "Welcome", body: "Nursing courses are open.", audience: "EVERYONE" });
    expect(platform.ok).toBe(true);
    expect(await postPlatformAnnouncement(teacher, { title: "x", body: "y", audience: "EVERYONE" })).toMatchObject({ ok: false });

    if (courseNote.ok && platform.ok) {
      expect(await deleteAnnouncement(other, courseNote.data.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect(await deleteAnnouncement(teacher, platform.data.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect((await deleteAnnouncement(teacher, courseNote.data.id)).ok).toBe(true);
      expect((await deleteAnnouncement(admin, platform.data.id)).ok).toBe(true);
    }
  });
});
