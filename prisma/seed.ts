/**
 * Demo data for local development: three subjects, teachers, students,
 * courses with real lesson content, and some activity so every screen has
 * something to show. Wipes the database first.
 *
 * All demo accounts share one password, taken from SEED_DEMO_PASSWORD or
 * generated and printed once. Nothing secret is stored in this repository.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { slugify } from "../src/lib/slug";
import { hashPassword } from "../src/server/auth/password-core";
import { grammar, persuasiveEssay } from "./seed-content/english";
import { algebra, fractions } from "./seed-content/maths";
import { dosage, infection } from "./seed-content/nursing";
import { seedTeachers } from "./seed-content/seed-teachers";
import type { SeedCourse } from "./seed-content/types";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
if (!url.startsWith("file:") && process.env.SEED_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing to wipe a remote database. Set SEED_ALLOW_REMOTE=1 if you really mean it.");
}

const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined }) });
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const SUBJECTS = [
  {
    slug: "english",
    name: "English",
    tagline: "Grammar, writing and reading with purpose",
    description: "Clear, correct writing, from sentence structure and punctuation to essays that hold an argument.",
    color: "#B3374A",
  },
  {
    slug: "mathematics",
    name: "Mathematics",
    tagline: "Number, algebra and problem solving",
    description: "Work from the foundations up: arithmetic, algebra and the reasoning behind every step.",
    color: "#2356C2",
  },
  {
    slug: "nursing",
    name: "Nursing",
    tagline: "Clinical knowledge for safe practice",
    description: "Dosage calculations, patient safety and the core knowledge behind everyday clinical practice.",
    color: "#0A7684",
  },
] as const;

const PEOPLE = {
  admin: { name: "Platform Admin", email: "admin@example.com", role: "ADMIN" as const },
  grace: { name: "Grace Adeyemi", email: "grace@example.com", role: "TEACHER" as const, bio: "English teacher for twelve years, mostly exam classes. I care about writing that's easy to read." },
  daniel: { name: "Daniel Okafor", email: "daniel@example.com", role: "TEACHER" as const, bio: "Secondary maths teacher and tutor. I show every step, because the steps are the maths." },
  ruth: { name: "Ruth Mensah", email: "ruth@example.com", role: "TEACHER" as const, bio: "Nurse educator. I teach calculations the way I'd want them checked on a ward." },
  ada: { name: "Ada Obi", email: "ada@example.com", role: "STUDENT" as const },
  kemi: { name: "Kemi Balogun", email: "kemi@example.com", role: "STUDENT" as const },
  tomi: { name: "Tomi Ajayi", email: "tomi@example.com", role: "STUDENT" as const },
};

async function wipe() {
  await db.auditLog.deleteMany();
  await db.submission.deleteMany();
  await db.announcement.deleteMany();
  await db.course.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.subject.deleteMany();
}

async function createCourse(course: SeedCourse, subjectIds: Record<string, string>, teacherIds: Record<string, string>) {
  const published = course.status === "PUBLISHED";
  return db.course.create({
    data: {
      slug: slugify(course.title),
      title: course.title,
      summary: course.summary,
      description: course.description,
      level: course.level,
      status: course.status,
      isFeatured: Boolean(course.featured),
      submittedAt: course.status !== "DRAFT" ? daysAgo(published ? 30 : 1) : null,
      publishedAt: published ? daysAgo(28) : null,
      subjectId: subjectIds[course.subject],
      teacherId: teacherIds[course.teacher],
      lessons: {
        create: course.lessons.map((lesson, i) => ({
          title: lesson.title,
          body: lesson.body,
          durationMinutes: lesson.minutes,
          videoUrl: lesson.videoUrl ?? null,
          position: i + 1,
        })),
      },
      assessments: {
        create: course.assessments.map((a, i) => ({
          title: a.title,
          instructions: a.instructions,
          kind: a.kind,
          position: i + 1,
          passPercent: a.passPercent,
          isPublished: true,
          maxPoints: a.kind === "ASSIGNMENT" ? a.maxPoints : 100,
          dueAt: a.kind === "ASSIGNMENT" && a.dueInDays ? new Date(Date.now() + a.dueInDays * DAY) : null,
          questions:
            a.kind === "QUIZ"
              ? {
                  create: a.questions.map((q, qi) => ({
                    prompt: q.prompt,
                    explanation: q.explanation ?? null,
                    position: qi + 1,
                    options: { create: q.options.map((label, oi) => ({ label, isCorrect: oi === q.correct, position: oi + 1 })) },
                  })),
                }
              : undefined,
        })),
      },
    },
    include: {
      lessons: { orderBy: { position: "asc" } },
      assessments: { orderBy: { position: "asc" }, include: { questions: { orderBy: { position: "asc" }, include: { options: true } } } },
    },
  });
}

type CreatedCourse = Awaited<ReturnType<typeof createCourse>>;

async function completeLessons(userId: string, course: CreatedCourse, count: number, startDaysAgo: number) {
  for (const [i, lesson] of course.lessons.slice(0, count).entries()) {
    await db.lessonProgress.create({ data: { userId, lessonId: lesson.id, completedAt: daysAgo(startDaysAgo - i) } });
  }
}

async function quizAttempt(userId: string, course: CreatedCourse, correctCount: number, when: Date) {
  const quiz = course.assessments.find((a) => a.kind === "QUIZ");
  if (!quiz) return;
  const answers = Object.fromEntries(
    quiz.questions.map((q, i) => {
      const option = i < correctCount ? q.options.find((o) => o.isCorrect) : q.options.find((o) => !o.isCorrect);
      return [q.id, option!.id];
    }),
  );
  await db.submission.create({
    data: {
      assessmentId: quiz.id,
      studentId: userId,
      answers: JSON.stringify(answers),
      score: correctCount,
      maxScore: quiz.questions.length,
      status: "GRADED",
      submittedAt: when,
      gradedAt: when,
    },
  });
}

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD || `demo-${randomBytes(6).toString("base64url")}-7`;
  const passwordHash = await hashPassword(password);

  await wipe();

  const subjectIds: Record<string, string> = {};
  for (const [position, subject] of SUBJECTS.entries()) {
    const created = await db.subject.create({ data: { ...subject, position: position + 1 } });
    subjectIds[subject.slug] = created.id;
  }

  const ids: Record<string, string> = {};
  for (const [key, person] of Object.entries(PEOPLE)) {
    const created = await db.user.create({
      data: { ...person, passwordHash, status: "ACTIVE", createdAt: daysAgo(key === "admin" ? 60 : 40 - Object.keys(ids).length * 3), lastLoginAt: daysAgo(1) },
    });
    ids[key] = created.id;
  }
  const applicant = await db.user.create({
    data: {
      name: "Samuel Eze",
      email: "samuel@example.com",
      passwordHash,
      role: "TEACHER",
      status: "PENDING",
      applicationSubjectId: subjectIds.mathematics,
      applicationNote:
        "I've taught GCSE and WAEC maths for six years, and run weekend revision classes for about 40 students. I'd like to publish a course on quadratic equations.",
      createdAt: daysAgo(2),
    },
  });

  // Recent sign-ups, so the admin chart has a realistic fortnight.
  const RECENT_STUDENTS: Array<[string, number]> = [
    ["Chidi Nwosu", 13], ["Funmi Adebayo", 11], ["Ibrahim Musa", 9], ["Zainab Bello", 9],
    ["Emeka Obi", 6], ["Halima Yusuf", 4], ["Ngozi Eze", 2], ["Tobi Lawal", 1],
  ];
  const recentIds: string[] = [];
  for (const [name, days] of RECENT_STUDENTS) {
    const email = `${name.split(" ")[0].toLowerCase()}@example.com`;
    const created = await db.user.create({ data: { name, email, passwordHash, role: "STUDENT", status: "ACTIVE", createdAt: daysAgo(days) } });
    recentIds.push(created.id);
    ids[name.split(" ")[0].toLowerCase()] = created.id;
  }

  const courses: Record<string, CreatedCourse> = {};
  for (const course of [grammar, persuasiveEssay, algebra, fractions, dosage, infection]) {
    courses[course.key] = await createCourse(course, subjectIds, ids);
  }

  // Enrolments and progress.
  const enrol = (user: string, course: string, days: number, completed = false) =>
    db.enrollment.create({ data: { userId: ids[user], courseId: courses[course].id, createdAt: daysAgo(days), completedAt: completed ? daysAgo(2) : null } });

  await enrol("ada", "algebra", 20, true);
  await completeLessons(ids.ada, courses.algebra, 3, 18);
  await quizAttempt(ids.ada, courses.algebra, 3, daysAgo(4));
  await quizAttempt(ids.ada, courses.algebra, 5, daysAgo(2));

  await enrol("ada", "grammar", 12);
  await completeLessons(ids.ada, courses.grammar, 2, 10);
  await quizAttempt(ids.ada, courses.grammar, 4, daysAgo(3));

  await enrol("ada", "dosage", 6);
  await completeLessons(ids.ada, courses.dosage, 1, 5);
  const dosageAssignment = courses.dosage.assessments.find((a) => a.kind === "ASSIGNMENT")!;
  await db.submission.create({
    data: {
      assessmentId: dosageAssignment.id,
      studentId: ids.ada,
      response:
        "0.75 g is 750 mg. Using the formula, (750 ÷ 250) × 1 tablet = 3 tablets.\n\nTo check: the order is three times the tablet strength, so three tablets makes sense. I would also confirm the patient, drug, route and time, and ask a colleague to check if the drug is high-alert.",
      maxScore: dosageAssignment.maxPoints,
      submittedAt: daysAgo(1),
    },
  });

  await enrol("kemi", "algebra", 9);
  await completeLessons(ids.kemi, courses.algebra, 1, 8);
  await enrol("kemi", "dosage", 15);
  await completeLessons(ids.kemi, courses.dosage, 3, 14);
  await quizAttempt(ids.kemi, courses.dosage, 4, daysAgo(6));
  await db.submission.create({
    data: {
      assessmentId: dosageAssignment.id,
      studentId: ids.kemi,
      response: "750 mg ÷ 250 mg = 3 tablets. I'd check by multiplying back: 3 × 250 mg = 750 mg, which matches the order.",
      maxScore: dosageAssignment.maxPoints,
      score: 8,
      status: "GRADED",
      feedback: "Right answer and a good check. Next time, show the g to mg conversion as its own step.",
      gradedById: ids.ruth,
      submittedAt: daysAgo(5),
      gradedAt: daysAgo(4),
    },
  });

  await enrol("tomi", "grammar", 4);
  await completeLessons(ids.tomi, courses.grammar, 3, 3);
  const grammarAssignment = courses.grammar.assessments.find((a) => a.kind === "ASSIGNMENT")!;
  await db.submission.create({
    data: {
      assessmentId: grammarAssignment.id,
      studentId: ids.tomi,
      response:
        "They're going to the clinic on Monday. The doctor said it's important, because the results came back. They need to bring their forms, and they also need ID.\n\nI fixed they're/their/it's, joined the fragment onto the sentence before it, and added 'and' to fix the comma splice.",
      maxScore: grammarAssignment.maxPoints,
      submittedAt: daysAgo(0.2),
    },
  });

  const openCourses = ["algebra", "dosage", "grammar", "fractions"];
  for (const [i, id] of recentIds.entries()) {
    await db.enrollment.create({ data: { userId: id, courseId: courses[openCourses[i % openCourses.length]].id, createdAt: daysAgo(RECENT_STUDENTS[i][1]) } });
  }

  // Teacher directory: topics, profiles, requests, sessions, messages, reviews.
  const extraTeachers = await seedTeachers(db, ids, subjectIds, passwordHash);

  // Announcements.
  await db.announcement.create({
    data: {
      title: "Welcome to the new term",
      body: "English, Mathematics and Nursing courses are open. Enrol in as many as you like; it's free.",
      audience: "EVERYONE",
      authorId: ids.admin,
      createdAt: daysAgo(7),
    },
  });
  await db.announcement.create({
    data: {
      title: "Practice quiz is open",
      body: "The dosage practice quiz is live. Aim for 80%, and retake it until you get there.",
      courseId: courses.dosage.id,
      audience: "STUDENTS",
      authorId: ids.ruth,
      createdAt: daysAgo(3),
    },
  });

  // Activity log.
  const log = [
    { action: "user.approve", entity: "user", entityId: ids.grace, summary: "Approved teacher: Grace Adeyemi", createdAt: daysAgo(35) },
    { action: "user.approve", entity: "user", entityId: ids.daniel, summary: "Approved teacher: Daniel Okafor", createdAt: daysAgo(34) },
    { action: "user.approve", entity: "user", entityId: ids.ruth, summary: "Approved teacher: Ruth Mensah", createdAt: daysAgo(33) },
    { action: "course.approve", entity: "course", entityId: courses.grammar.id, summary: "Approved and published: Grammar that holds up", createdAt: daysAgo(28) },
    { action: "course.approve", entity: "course", entityId: courses.algebra.id, summary: "Approved and published: Algebra from the ground up", createdAt: daysAgo(28) },
    { action: "course.approve", entity: "course", entityId: courses.dosage.id, summary: "Approved and published: Medication dosage calculations", createdAt: daysAgo(27) },
    { action: "announcement.post", entity: "announcement", entityId: null, summary: "Posted announcement: Welcome to the new term", createdAt: daysAgo(7) },
  ];
  for (const entry of log) await db.auditLog.create({ data: { ...entry, actorId: ids.admin } });

  console.log("\nSeeded demo data.");
  console.log("Accounts (all share one password):");
  for (const person of [...Object.values(PEOPLE), { name: applicant.name, email: applicant.email, role: "TEACHER (pending)" }]) {
    console.log(`  ${person.role.padEnd(18)} ${person.email}`);
  }
  console.log(`  TEACHER            ${extraTeachers.join(", ")}`);
  console.log(`  plus ${RECENT_STUDENTS.length} recently joined students (firstname@example.com)`);
  if (process.env.SEED_DEMO_PASSWORD) {
    console.log("Password: the value of SEED_DEMO_PASSWORD.\n");
  } else {
    console.log(`Generated password (shown once, not saved anywhere): ${password}\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
