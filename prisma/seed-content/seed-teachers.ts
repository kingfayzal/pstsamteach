import type { createPrismaClient } from "../../src/server/db-client";
import { generateSlots } from "../../src/lib/scheduling";
import { slugify } from "../../src/lib/slug";
import { addDays, zonedParts, zonedTimeToUtc } from "../../src/lib/time-zones";
import { TEACHERS, TOPICS, type TeacherSeed } from "./teachers";

type Ids = Record<string, string>;
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** A wall-clock time `daysAgo` days back in a zone, e.g. last Tuesday 18:00 in Accra. */
function pastAt(daysAgo: number, hour: number, timeZone: string): Date {
  const date = addDays(zonedParts(new Date(), timeZone), -daysAgo);
  return zonedTimeToUtc({ ...date, hour, minute: 0 }, timeZone);
}

async function createTopics(db: ReturnType<typeof createPrismaClient>, subjectIds: Ids): Promise<Ids> {
  const topicIds: Ids = {};
  for (const [subject, names] of Object.entries(TOPICS)) {
    for (const [position, name] of names.entries()) {
      const topic = await db.topic.create({ data: { subjectId: subjectIds[subject], name, slug: slugify(name), position: position + 1 } });
      topicIds[name] = topic.id;
    }
  }
  return topicIds;
}

async function createProfile(db: ReturnType<typeof createPrismaClient>, teacherId: string, spec: TeacherSeed, topicIds: Ids) {
  return db.teacherProfile.create({
    data: {
      userId: teacherId,
      slug: slugify(spec.name, "teacher"),
      headline: spec.headline,
      about: spec.about,
      teachingStyle: spec.teachingStyle,
      qualifications: spec.qualifications,
      experienceYears: spec.experienceYears,
      timeZone: spec.timeZone,
      sessionMinutes: spec.sessionMinutes,
      acceptingStudents: spec.acceptingStudents,
      meetingUrl: `https://meet.example.com/${slugify(spec.name)}`,
      topics: { create: spec.topics.flatMap((t) => t.names.map((name) => ({ topicId: topicIds[name] }))) },
      languages: { create: spec.languages.map((language) => ({ language })) },
      availability: { create: spec.windows },
      createdAt: new Date(Date.now() - 30 * DAY),
    },
  });
}

/** The next open slots for a teacher, so seeded upcoming sessions sit inside real availability. */
function openSlots(spec: TeacherSeed) {
  return generateSlots({ windows: spec.windows, timeZone: spec.timeZone, sessionMinutes: spec.sessionMinutes, now: new Date() });
}

export async function seedTeachers(db: ReturnType<typeof createPrismaClient>, ids: Ids, subjectIds: Ids, passwordHash: string): Promise<string[]> {
  const topicIds = await createTopics(db, subjectIds);
  const teacherIds: Ids = { ...ids };
  for (const spec of TEACHERS) {
    if (!spec.isExisting) {
      const user = await db.user.create({
        data: { name: spec.name, email: spec.email, passwordHash, role: "TEACHER", status: "ACTIVE", createdAt: new Date(Date.now() - 32 * DAY) },
      });
      teacherIds[spec.key] = user.id;
    }
    await createProfile(db, teacherIds[spec.key], spec, topicIds);
  }
  const spec = (key: string) => TEACHERS.find((t) => t.key === key)!;

  const connect = async (student: string, teacher: string, status: "ACTIVE" | "PENDING" | "ENDED" | "DECLINED", topic: string, goals: string, daysAgo: number, extra = {}) =>
    db.teacherConnection.create({
      data: {
        studentId: ids[student],
        teacherId: teacherIds[teacher],
        status,
        topicId: topicIds[topic],
        goals,
        createdAt: new Date(Date.now() - daysAgo * DAY),
        respondedAt: status === "PENDING" ? null : new Date(Date.now() - (daysAgo - 0.5) * DAY),
        ...extra,
      },
    });

  const session = (connectionId: string, teacher: string, start: Date, status: "CONFIRMED" | "REQUESTED" = "CONFIRMED", agenda?: string) =>
    db.tutoringSession.create({
      data: {
        connectionId,
        teacherId: teacherIds[teacher],
        startsAt: start,
        endsAt: new Date(start.getTime() + spec(teacher).sessionMinutes * MINUTE),
        status,
        agenda,
      },
    });

  // Ada and Ruth: working together, two sessions done, one coming up, a message waiting.
  const adaRuth = await connect("ada", "ruth", "ACTIVE", "Dosage calculations", "I'm a second-year nursing student. Tablet doses are fine, but I keep getting liquid doses wrong and I have my exam in March.", 12);
  await session(adaRuth.id, "ruth", pastAt(9, 18, "Africa/Accra"), "CONFIRMED", "Liquid doses");
  await session(adaRuth.id, "ruth", pastAt(2, 18, "Africa/Accra"), "CONFIRMED", "Unit conversions");
  const ruthSlots = openSlots(spec("ruth"));
  if (ruthSlots[0]) await session(adaRuth.id, "ruth", ruthSlots[0].start, "CONFIRMED", "Practice quiz questions 4 and 5");
  for (const [from, body, daysAgo, read] of [
    ["ada", "Thank you for accepting me! Tablets are fine, it's the liquid doses that confuse me.", 11.5, true],
    ["ruth", "Glad to have you, Ada. We'll start with the formula method and do lots of liquid examples.", 11.4, true],
    ["ruth", "Before our next session, try questions 4 and 5 in the practice quiz and bring your working.", 1, false],
  ] as const) {
    await db.message.create({
      data: { connectionId: adaRuth.id, senderId: from === "ada" ? ids.ada : teacherIds.ruth, body, createdAt: new Date(Date.now() - daysAgo * DAY), readAt: read ? new Date() : null },
    });
  }

  // Ada has also asked Daniel, with a first session proposed.
  const adaDaniel = await connect("ada", "daniel", "PENDING", "Algebra", "I need to pass a maths entrance test for my nursing top-up course. I haven't done algebra since school.", 1);
  const danielSlots = openSlots(spec("daniel"));
  if (danielSlots[1]) await session(adaDaniel.id, "daniel", danielSlots[1].start, "REQUESTED", "Solving equations");

  // Other students, for realistic numbers and reviews.
  const kemiRuth = await connect("kemi", "ruth", "ACTIVE", "Licensing exam preparation", "Preparing for my licensing exam and want timed practice on calculations.", 20);
  await session(kemiRuth.id, "ruth", pastAt(6, 10, "Africa/Accra"));
  const tomiGrace = await connect("tomi", "grace", "ACTIVE", "Grammar and punctuation", "I want my reports at work to read more professionally.", 10);
  await session(tomiGrace.id, "grace", pastAt(4, 19, "Africa/Lagos"), "CONFIRMED", "Comma splices");
  const graceSlots = openSlots(spec("grace"));
  if (graceSlots[2]) await session(tomiGrace.id, "grace", graceSlots[2].start, "CONFIRMED", "Report structure");
  await db.message.create({
    data: { connectionId: tomiGrace.id, senderId: teacherIds.grace, body: "Send me your latest report before Thursday and we'll mark it together.", createdAt: new Date(Date.now() - 2 * DAY) },
  });
  const zainabDaniel = await connect("zainab", "daniel", "ACTIVE", "Exam preparation", "Retaking my maths exam in June.", 8);
  await session(zainabDaniel.id, "daniel", pastAt(3, 17, "Africa/Lagos"));
  const chidiKwame = await connect("chidi", "kwame", "ENDED", "Statistics", "Stats module for my public health degree.", 13, { endedAt: new Date(Date.now() - 2 * DAY), endedById: ids.chidi });
  await session(chidiKwame.id, "kwame", pastAt(7, 19, "Africa/Accra"));
  const halimaBlessing = await connect("halima", "blessing", "ACTIVE", "Spoken English", "I have job interviews coming up and freeze when speaking.", 4);
  await session(halimaBlessing.id, "blessing", pastAt(1, 8, "Africa/Lagos"));
  const emekaYusuf = await connect("emeka", "yusuf", "ACTIVE", "Arithmetic", "Going back to college and need to brush up on percentages.", 6);
  await session(emekaYusuf.id, "yusuf", pastAt(3, 10, "Africa/Lagos"));
  await connect("funmi", "amaka", "DECLINED", "Maternal and child health", "Midwifery student looking for weekly help.", 5, {
    responseNote: "I'm full on the evenings you need. Ruth Mensah teaches on Saturdays and would be a great fit.",
  });

  // Reviews from students who've had sessions.
  const reviews: [string, string, number, string][] = [
    ["kemi", "ruth", 5, "Ruth makes you check every answer, and after three sessions I do it without thinking. My practice scores went from 60% to 90%."],
    ["tomi", "grace", 5, "Very clear and very kind. She marked my report line by line and I finally understand where commas go."],
    ["zainab", "daniel", 5, "Daniel explains every step and never rushes. Algebra makes sense now."],
    ["chidi", "kwame", 4, "Knows statistics inside out. Sessions are long but worth it for working through full exam questions."],
    ["halima", "blessing", 5, "The interview role-plays were exactly what I needed. I got the job!"],
    ["emeka", "yusuf", 4, "Patient and uses everyday examples. Percentages finally clicked."],
  ];
  for (const [student, teacher, rating, body] of reviews) {
    await db.teacherReview.create({ data: { studentId: ids[student], teacherId: teacherIds[teacher], rating, body, createdAt: new Date(Date.now() - 1 * DAY) } });
  }

  // Ada's shortlist.
  for (const teacher of ["amaka", "kwame"]) await db.savedTeacher.create({ data: { studentId: ids.ada, teacherId: teacherIds[teacher] } });

  return TEACHERS.filter((t) => !t.isExisting).map((t) => t.email);
}
