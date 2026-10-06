import { randomUUID } from "node:crypto";
import type { AssessmentKind, CourseStatus, Role, UserStatus } from "@/generated/prisma/enums";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import type { Actor } from "@/server/services/result";

/** Generated per run so no credential is ever written into the repo. */
export const TEST_PASSWORD = `pw-${randomUUID()}-9`;

let cachedHash: Promise<string> | null = null;
const passwordHash = () => (cachedHash ??= hashPassword(TEST_PASSWORD));

let counter = 0;
const next = () => ++counter;

export async function resetDb(): Promise<void> {
  await db.auditLog.deleteMany();
  await db.submission.deleteMany();
  await db.announcement.deleteMany();
  await db.course.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.subject.deleteMany();
  await db.rateLimit.deleteMany();
  await db.emailOutbox.deleteMany();
  await db.accountToken.deleteMany();
}

/** Users have a confirmed email address unless a test says otherwise (`confirmed: false`). */
export async function makeUser(
  overrides: Partial<{ role: Role; status: UserStatus; name: string; email: string; confirmed: boolean }> = {},
): Promise<Actor> {
  const n = next();
  return db.user.create({
    data: {
      name: overrides.name ?? `User ${n}`,
      email: overrides.email ?? `user${n}@example.com`,
      role: overrides.role ?? "STUDENT",
      status: overrides.status ?? "ACTIVE",
      emailVerifiedAt: overrides.confirmed === false ? null : new Date(),
      passwordHash: await passwordHash(),
    },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
}

export const makeStudent = () => makeUser({ role: "STUDENT" });
export const makeTeacher = () => makeUser({ role: "TEACHER" });
export const makeAdmin = () => makeUser({ role: "ADMIN" });

export async function makeSubject(overrides: Partial<{ name: string; isActive: boolean }> = {}) {
  const n = next();
  const name = overrides.name ?? `Subject ${n}`;
  return db.subject.create({
    data: {
      name,
      slug: `subject-${n}`,
      tagline: "A tagline",
      description: "A subject description.",
      color: "#2356C2",
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function makeCourse(
  teacherId: string,
  subjectId: string,
  overrides: Partial<{ status: CourseStatus; lessons: number; title: string; description: string }> = {},
) {
  const n = next();
  const lessonCount = overrides.lessons ?? 2;
  return db.course.create({
    data: {
      title: overrides.title ?? `Course ${n}`,
      slug: `course-${n}`,
      summary: "A summary that is long enough.",
      description: overrides.description ?? "d".repeat(100),
      status: overrides.status ?? "DRAFT",
      subjectId,
      teacherId,
      lessons: {
        create: Array.from({ length: lessonCount }, (_, i) => ({
          title: `Lesson ${i + 1}`,
          body: `Body of lesson ${i + 1}`,
          position: i + 1,
        })),
      },
    },
    include: { lessons: { orderBy: { position: "asc" } } },
  });
}

type QuizSpec = { prompt: string; options: { label: string; isCorrect: boolean }[] };

export async function makeAssessment(
  courseId: string,
  overrides: Partial<{
    kind: AssessmentKind;
    isPublished: boolean;
    passPercent: number;
    maxPoints: number;
    questions: QuizSpec[];
    dueAt: Date | null;
  }> = {},
) {
  const n = next();
  const kind = overrides.kind ?? "QUIZ";
  const questions: QuizSpec[] =
    overrides.questions ??
    (kind === "QUIZ"
      ? [
          { prompt: "2 + 2", options: [{ label: "4", isCorrect: true }, { label: "5", isCorrect: false }] },
          { prompt: "3 x 3", options: [{ label: "6", isCorrect: false }, { label: "9", isCorrect: true }] },
        ]
      : []);
  return db.assessment.create({
    data: {
      courseId,
      title: `Assessment ${n}`,
      instructions: "Do the work.",
      kind,
      position: n,
      isPublished: overrides.isPublished ?? true,
      passPercent: overrides.passPercent ?? 60,
      maxPoints: overrides.maxPoints ?? 100,
      dueAt: overrides.dueAt ?? null,
      questions: {
        create: questions.map((q, i) => ({
          prompt: q.prompt,
          position: i + 1,
          options: { create: q.options.map((o, j) => ({ label: o.label, isCorrect: o.isCorrect, position: j + 1 })) },
        })),
      },
    },
    include: { questions: { include: { options: true }, orderBy: { position: "asc" } } },
  });
}

export async function enroll(userId: string, courseId: string) {
  return db.enrollment.create({ data: { userId, courseId } });
}

export async function makeTopic(subjectId: string, name = `Topic ${next()}`) {
  return db.topic.create({ data: { subjectId, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") } });
}

type ProfileSpec = {
  headline?: string;
  about?: string;
  topicIds?: string[];
  languages?: string[];
  windows?: { weekday: number; startMinute: number; endMinute: number }[];
  timeZone?: string;
  sessionMinutes?: number;
  acceptingStudents?: boolean;
  isHidden?: boolean;
};

/** A complete, listable profile by default: Monday 18:00–20:00 Lagos, 60-minute sessions. */
export async function makeTeacherProfile(teacherId: string, spec: ProfileSpec = {}) {
  const n = next();
  return db.teacherProfile.create({
    data: {
      userId: teacherId,
      slug: `teacher-${n}`,
      headline: spec.headline ?? "Patient teacher who explains every step",
      about: spec.about ?? "I have taught for many years and love helping students who find the subject hard.".padEnd(90, "."),
      timeZone: spec.timeZone ?? "Africa/Lagos",
      sessionMinutes: spec.sessionMinutes ?? 60,
      acceptingStudents: spec.acceptingStudents ?? true,
      isHidden: spec.isHidden ?? false,
      meetingUrl: "https://meet.example.com/room",
      topics: { create: (spec.topicIds ?? []).map((topicId) => ({ topicId })) },
      languages: { create: (spec.languages ?? ["English"]).map((language) => ({ language })) },
      availability: { create: spec.windows ?? [{ weekday: 1, startMinute: 18 * 60, endMinute: 20 * 60 }] },
    },
  });
}
