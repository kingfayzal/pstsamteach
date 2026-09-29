/**
 * Clearly-labelled demo records ("D-" names) for showing the platform on a
 * real deployment. Unlike the seed, this never wipes anything: it adds or
 * updates exactly these records, and removes exactly these records.
 */
import type { createPrismaClient } from "../src/server/db-client";
import { slugify } from "../src/lib/slug";

type Db = ReturnType<typeof createPrismaClient>;
type Window = { weekday: number; startMinute: number; endMinute: number };

/**
 * Whether production should have the demo data. Every production deploy applies
 * this (scripts/vercel-build.mjs runs `demo.ts sync`): true adds the demo data
 * if it isn't there, false removes it. Change it and push to switch.
 */
export const DEMO_DATA_ON_PRODUCTION = true;

const h = (hour: number) => hour * 60;
const days = (weekdays: number[], start: number, end: number): Window[] => weekdays.map((weekday) => ({ weekday, startMinute: start, endMinute: end }));

// Positions after the real subjects, so demo subjects are listed last.
const FIRST_POSITION = 100;

export const DEMO_SUBJECTS = [
  {
    slug: "d-science",
    name: "D-Science",
    tagline: "Biology, chemistry and physics from the ground up",
    description: "The core ideas of biology, chemistry and physics, explained with everyday examples and plenty of practice.",
    color: "#3B7A2A",
    topics: ["Biology basics", "Chemistry basics", "Physics basics"],
  },
  {
    slug: "d-history",
    name: "D-History",
    tagline: "People, events and how to write about them",
    description: "How the world got to where it is, and how to read sources and build an argument about the past.",
    color: "#8C5A14",
    topics: ["World history", "African history", "Source analysis"],
  },
  {
    slug: "d-geography",
    name: "D-Geography",
    tagline: "Places, maps and the physical world",
    description: "Landscapes, climate, cities and the people who live in them, with the map skills to explain it all.",
    color: "#6A45A5",
    topics: ["Physical geography", "Human geography", "Map skills"],
  },
] as const;

export const DEMO_TEACHERS = [
  {
    name: "D-Mark Buck",
    email: "d-mark.buck@example.com",
    subject: "d-science",
    headline: "Science teacher who starts from what you already know",
    about:
      "I've taught secondary science for eight years, mostly to students who were told they 'aren't science people'. We start with things you've seen in real life and build the theory from there.\n\nBring your homework, your exam worries or just a question you've always wondered about.",
    teachingStyle: "Short explanations, then you try it. We use diagrams and simple experiments you can do at home, and finish every session with three practice questions.",
    qualifications: "BSc Biology\nPGCE Secondary Science",
    experienceYears: 8,
    languages: ["English"],
    timeZone: "Europe/London",
    windows: [...days([1, 3], h(18), h(21)), ...days([6], h(10), h(13))],
  },
  {
    name: "D-Amara Eze",
    email: "d-amara.eze@example.com",
    subject: "d-history",
    headline: "History tutor for essays that actually answer the question",
    about:
      "I teach history to secondary and first-year university students. Most of my students know the facts; what they need is help turning them into a clear argument backed by sources.\n\nWe'll work on your real essays and past questions, one paragraph at a time.",
    teachingStyle: "We read a source together, pull out the evidence, then plan an answer before writing it. You'll leave each session with a plan you can finish on your own.",
    qualifications: "BA History\nMA African Studies",
    experienceYears: 6,
    languages: ["English", "Igbo"],
    timeZone: "Africa/Lagos",
    windows: [...days([2, 4], h(17), h(20)), ...days([0], h(14), h(17))],
  },
  {
    name: "D-Tunde Bakare",
    email: "d-tunde.bakare@example.com",
    subject: "d-geography",
    headline: "Geography made visual: maps, sketches and real places",
    about:
      "Geography makes sense when you can see it. I use maps, satellite images and quick sketches to explain landscapes, climate and cities, then connect them to the questions examiners ask.\n\nI teach exam classes and adults who are simply curious about the world.",
    teachingStyle: "Every topic starts with a real place. We sketch it, label it and explain it, then practise the exam-style questions that go with it.",
    qualifications: "BSc Geography\nPostgraduate diploma in education",
    experienceYears: 10,
    languages: ["English", "Yoruba"],
    timeZone: "Africa/Lagos",
    windows: [...days([1, 5], h(16), h(19)), ...days([6], h(9), h(12))],
  },
] as const;

export const DEMO_STUDENTS = [
  { name: "D-Chioma Okeke", email: "d-chioma.okeke@example.com", timeZone: "Africa/Lagos" },
  { name: "D-Liam Carter", email: "d-liam.carter@example.com", timeZone: "Europe/London" },
  { name: "D-Zainab Bello", email: "d-zainab.bello@example.com", timeZone: "Africa/Lagos" },
] as const;

const DEMO_EMAILS = [...DEMO_TEACHERS, ...DEMO_STUDENTS].map((person) => person.email);
const DEMO_SUBJECT_SLUGS = DEMO_SUBJECTS.map((subject) => subject.slug);

// Several dozen statements; generous limits so a slow remote connection doesn't time out.
const TRANSACTION = { maxWait: 10_000, timeout: 60_000 };

/**
 * Add the demo subjects, teachers and students, or bring existing ones back to
 * this definition. Every demo account gets `passwordHash`, and loses any open
 * sessions when it changes.
 */
export async function addDemoData(db: Db, passwordHash: string): Promise<{ subjects: number; teachers: number; students: number }> {
  await db.$transaction(async (tx) => {
    const topicIds = new Map<string, string[]>();
    for (const [index, { topics, ...subject }] of DEMO_SUBJECTS.entries()) {
      const fields = { ...subject, position: FIRST_POSITION + index, isActive: true };
      const saved = await tx.subject.upsert({ where: { slug: subject.slug }, create: fields, update: fields, select: { id: true } });
      const ids: string[] = [];
      for (const [position, name] of topics.entries()) {
        const topic = await tx.topic.upsert({
          where: { subjectId_slug: { subjectId: saved.id, slug: slugify(name, "topic") } },
          create: { subjectId: saved.id, name, slug: slugify(name, "topic"), position },
          update: { name, position },
          select: { id: true },
        });
        ids.push(topic.id);
      }
      topicIds.set(subject.slug, ids);
    }

    const accounts = [
      ...DEMO_TEACHERS.map((teacher) => ({ name: teacher.name, email: teacher.email, timeZone: teacher.timeZone, role: "TEACHER" as const })),
      ...DEMO_STUDENTS.map((student) => ({ ...student, role: "STUDENT" as const })),
    ];
    const userIds = new Map<string, string>();
    for (const account of accounts) {
      const fields = { name: account.name, role: account.role, status: "ACTIVE" as const, timeZone: account.timeZone, passwordHash };
      const user = await tx.user.upsert({ where: { email: account.email }, create: { email: account.email, ...fields }, update: fields, select: { id: true } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      userIds.set(account.email, user.id);
    }

    for (const teacher of DEMO_TEACHERS) {
      const userId = userIds.get(teacher.email)!;
      const slug = slugify(teacher.name, "teacher");
      const fields = {
        headline: teacher.headline,
        about: teacher.about,
        teachingStyle: teacher.teachingStyle,
        qualifications: teacher.qualifications,
        experienceYears: teacher.experienceYears,
        timeZone: teacher.timeZone,
        sessionMinutes: 60,
        acceptingStudents: true,
        isHidden: false,
        meetingUrl: `https://meet.example.com/${slug}`,
      };
      const topics = (topicIds.get(teacher.subject) ?? []).map((topicId) => ({ topicId }));
      const languages = teacher.languages.map((language) => ({ language }));
      const availability = [...teacher.windows];
      await tx.teacherProfile.upsert({
        where: { userId },
        create: { userId, slug, ...fields, topics: { create: topics }, languages: { create: languages }, availability: { create: availability } },
        update: {
          ...fields,
          topics: { deleteMany: {}, create: topics },
          languages: { deleteMany: {}, create: languages },
          availability: { deleteMany: {}, create: availability },
        },
      });
    }
  }, TRANSACTION);
  return { subjects: DEMO_SUBJECTS.length, teachers: DEMO_TEACHERS.length, students: DEMO_STUDENTS.length };
}

/** True when any demo account or subject exists. */
export async function demoDataPresent(db: Db): Promise<boolean> {
  const [users, subjects] = await Promise.all([
    db.user.count({ where: { email: { in: DEMO_EMAILS } } }),
    db.subject.count({ where: { slug: { in: DEMO_SUBJECT_SLUGS } } }),
  ]);
  return users + subjects > 0;
}

export type DemoSync =
  | { action: "added" }
  | { action: "kept" }
  | { action: "removed"; users: number; subjects: number; keptSubjects: string[] };

/**
 * Bring a database in line with the demo switch. When on, the demo data is
 * added only if none of it exists yet, so accounts, passwords and any edits
 * made while demoing survive later deploys. When off, it's removed.
 */
export async function syncDemoData(db: Db, enabled: boolean, makePasswordHash: () => Promise<string>): Promise<DemoSync> {
  if (!enabled) return { action: "removed", ...(await removeDemoData(db)) };
  if (await demoDataPresent(db)) return { action: "kept" };
  await addDemoData(db, await makePasswordHash());
  return { action: "added" };
}

/**
 * Remove exactly the demo records: the demo accounts (with everything attached
 * to them, including courses the demo teachers made) and the demo subjects.
 * A demo subject that still holds someone else's courses is kept and reported.
 */
export async function removeDemoData(db: Db): Promise<{ users: number; subjects: number; keptSubjects: string[] }> {
  return db.$transaction(async (tx) => {
    const demoUsers = await tx.user.findMany({ where: { email: { in: DEMO_EMAILS } }, select: { id: true } });
    const userIds = demoUsers.map((user) => user.id);
    await tx.course.deleteMany({ where: { teacherId: { in: userIds } } });
    const users = await tx.user.deleteMany({ where: { id: { in: userIds } } });

    const subjects = await tx.subject.findMany({
      where: { slug: { in: DEMO_SUBJECT_SLUGS } },
      select: { id: true, name: true, _count: { select: { courses: true } } },
    });
    const removable = subjects.filter((subject) => subject._count.courses === 0);
    await tx.subject.deleteMany({ where: { id: { in: removable.map((subject) => subject.id) } } });
    const keptSubjects = subjects.filter((subject) => subject._count.courses > 0).map((subject) => subject.name);
    return { users: users.count, subjects: removable.length, keptSubjects };
  }, TRANSACTION);
}
