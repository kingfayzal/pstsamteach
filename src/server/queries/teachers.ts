import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { shortName } from "@/lib/format";
import {
  availabilityMatches,
  BOOKING_HORIZON_DAYS,
  generateSlots,
  groupSlotsByDay,
  type Interval,
  nextAvailableSlot,
  typicalWeek,
  weeklyTimetable,
} from "@/lib/scheduling";
import { type DirectoryFilters, isListed, profileGaps, sortTeachers } from "@/lib/teacher-directory";
import { db } from "@/server/db";
import { busyIntervals } from "@/server/services/teacher-common";

const DAY = 24 * 60 * 60 * 1000;

export type Viewer = { id?: string; role?: Role; timeZone: string };

const profileSelect = {
  id: true,
  slug: true,
  headline: true,
  about: true,
  teachingStyle: true,
  experienceYears: true,
  qualifications: true,
  videoUrl: true,
  timeZone: true,
  sessionMinutes: true,
  acceptingStudents: true,
  isHidden: true,
  createdAt: true,
  photo: { select: { updatedAt: true } },
  user: { select: { id: true, name: true, role: true, status: true } },
  topics: {
    select: { topic: { select: { id: true, name: true, slug: true, position: true, subject: { select: { name: true, slug: true, color: true, isActive: true, position: true } } } } },
  },
  languages: { select: { language: true } },
  availability: { select: { weekday: true, startMinute: true, endMinute: true } },
} satisfies Prisma.TeacherProfileSelect;

type ProfileRow = Prisma.TeacherProfileGetPayload<{ select: typeof profileSelect }>;

export type SubjectTopics = { name: string; slug: string; color: string; topics: { id: string; name: string; slug: string }[] };

/** A teacher's topics grouped under their (open) subjects, in display order. */
function groupTopics(profile: ProfileRow): SubjectTopics[] {
  const bySubject = new Map<string, SubjectTopics & { position: number }>();
  const sorted = [...profile.topics]
    .filter((t) => t.topic.subject.isActive)
    .sort((a, b) => a.topic.subject.position - b.topic.subject.position || a.topic.position - b.topic.position);
  for (const { topic } of sorted) {
    const current = bySubject.get(topic.subject.slug) ?? { ...topic.subject, topics: [] };
    bySubject.set(topic.subject.slug, { ...current, topics: [...current.topics, { id: topic.id, name: topic.name, slug: topic.slug }] });
  }
  return [...bySubject.values()].map(({ name, slug, color, topics }) => ({ name, slug, color, topics }));
}

function gapsOf(profile: ProfileRow): string[] {
  return profileGaps({
    headline: profile.headline,
    about: profile.about,
    topicCount: profile.topics.filter((t) => t.topic.subject.isActive).length,
    languageCount: profile.languages.length,
    windowCount: profile.availability.length,
  });
}

function listed(profile: ProfileRow): boolean {
  return isListed({ gaps: gapsOf(profile), isHidden: profile.isHidden, role: profile.user.role, status: profile.user.status });
}

export function photoUrl(profile: { id: string; photo: { updatedAt: Date } | null }): string | null {
  return profile.photo ? `/media/teachers/${profile.id}?v=${profile.photo.updatedAt.getTime()}` : null;
}

type TeacherStats = { average: number | null; reviewCount: number; students: number; sessionsTaught: number };

async function statsFor(teacherIds: string[], now: Date): Promise<Map<string, TeacherStats>> {
  const [reviews, students, sessions] = await Promise.all([
    db.teacherReview.groupBy({ by: ["teacherId"], where: { teacherId: { in: teacherIds }, isHidden: false }, _avg: { rating: true }, _count: { _all: true } }),
    db.teacherConnection.groupBy({ by: ["teacherId"], where: { teacherId: { in: teacherIds }, status: { in: ["ACTIVE", "ENDED"] } }, _count: { _all: true } }),
    db.tutoringSession.groupBy({ by: ["teacherId"], where: { teacherId: { in: teacherIds }, status: "CONFIRMED", endsAt: { lte: now } }, _count: { _all: true } }),
  ]);
  return new Map(
    teacherIds.map((id) => {
      const r = reviews.find((x) => x.teacherId === id);
      const average = r?._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null;
      return [
        id,
        {
          average,
          reviewCount: r?._count._all ?? 0,
          students: students.find((x) => x.teacherId === id)?._count._all ?? 0,
          sessionsTaught: sessions.find((x) => x.teacherId === id)?._count._all ?? 0,
        },
      ];
    }),
  );
}

async function busyByTeacher(teacherIds: string[], now: Date): Promise<Map<string, Interval[]>> {
  const sessions = await db.tutoringSession.findMany({
    where: {
      teacherId: { in: teacherIds },
      startsAt: { lt: new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * DAY) },
      endsAt: { gt: now },
      OR: [{ status: "CONFIRMED" }, { status: "REQUESTED", startsAt: { gt: now } }],
    },
    select: { teacherId: true, startsAt: true, endsAt: true },
  });
  const map = new Map<string, Interval[]>();
  for (const s of sessions) map.set(s.teacherId, [...(map.get(s.teacherId) ?? []), { start: s.startsAt, end: s.endsAt }]);
  return map;
}

const excerpt = (text: string, max = 220) => (text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`);

export type DirectoryRow = {
  profileId: string;
  slug: string;
  teacherId: string;
  name: string;
  headline: string;
  about: string;
  photo: string | null;
  acceptingStudents: boolean;
  experienceYears: number | null;
  createdAt: Date;
  subjects: SubjectTopics[];
  languages: string[];
  nextSlot: Date | null;
  saved: boolean;
} & TeacherStats;

export async function listDirectory(filters: DirectoryFilters, viewer: Viewer, now = new Date()): Promise<DirectoryRow[]> {
  const topicFilter =
    filters.subject || filters.topic
      ? { topics: { some: { topic: { ...(filters.topic ? { slug: filters.topic } : {}), subject: { isActive: true, ...(filters.subject ? { slug: filters.subject } : {}) } } } } }
      : {};
  const profiles = await db.teacherProfile.findMany({
    where: {
      isHidden: false,
      headline: { not: "" },
      user: {
        role: "TEACHER",
        status: "ACTIVE",
        ...(filters.saved && viewer.id ? { savedBy: { some: { studentId: viewer.id } } } : {}),
      },
      ...(filters.accepting ? { acceptingStudents: true } : {}),
      ...(filters.language ? { languages: { some: { language: filters.language } } } : {}),
      ...topicFilter,
      ...(filters.q ? { OR: [{ headline: { contains: filters.q } }, { about: { contains: filters.q } }, { user: { name: { contains: filters.q } } }] } : {}),
    },
    select: profileSelect,
    take: 300,
  });

  const visible = profiles.filter(listed);
  const intervalsById = new Map(visible.map((p) => [p.id, typicalWeek(p.availability, p.timeZone, now)]));
  const matching =
    filters.weekday === undefined && !filters.band
      ? visible
      : visible.filter((p) => availabilityMatches(intervalsById.get(p.id) ?? [], viewer.timeZone, { weekday: filters.weekday, band: filters.band }));

  const teacherIds = matching.map((p) => p.user.id);
  const [stats, busy, saved] = await Promise.all([
    statsFor(teacherIds, now),
    busyByTeacher(teacherIds, now),
    viewer.id ? db.savedTeacher.findMany({ where: { studentId: viewer.id, teacherId: { in: teacherIds } }, select: { teacherId: true } }) : [],
  ]);
  const savedIds = new Set(saved.map((s) => s.teacherId));

  const rows: DirectoryRow[] = matching.map((p) => ({
    profileId: p.id,
    slug: p.slug,
    teacherId: p.user.id,
    name: p.user.name,
    headline: p.headline,
    about: excerpt(p.about),
    photo: photoUrl(p),
    acceptingStudents: p.acceptingStudents,
    experienceYears: p.experienceYears,
    createdAt: p.createdAt,
    subjects: groupTopics(p),
    languages: p.languages.map((l) => l.language).sort(),
    nextSlot:
      nextAvailableSlot({ windows: p.availability, timeZone: p.timeZone, sessionMinutes: p.sessionMinutes, now, busy: busy.get(p.user.id) ?? [] })?.start ?? null,
    saved: savedIds.has(p.user.id),
    ...(stats.get(p.user.id) ?? { average: null, reviewCount: 0, students: 0, sessionsTaught: 0 }),
  }));
  return sortTeachers(rows, filters.sort);
}

/** Open subjects with their topics, for filters and the profile editor. */
export async function listSubjectsWithTopics() {
  return db.subject.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, color: true, topics: { orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } } },
  });
}

export async function getTeacherProfilePage(slug: string, viewer: Viewer, now = new Date()) {
  const profile = await db.teacherProfile.findUnique({ where: { slug }, select: profileSelect });
  if (!profile) return null;
  const isOwner = viewer.id === profile.user.id;
  const isListedNow = listed(profile);
  if (!isListedNow && !isOwner && viewer.role !== "ADMIN") return null;

  const teacherId = profile.user.id;
  const [stats, busy, reviews, courses, connection, saved, hadSession, ownReview] = await Promise.all([
    statsFor([teacherId], now),
    busyByTeacher([teacherId], now),
    db.teacherReview.findMany({
      where: { teacherId, isHidden: false },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, rating: true, body: true, createdAt: true, student: { select: { name: true } } },
    }),
    db.course.findMany({
      where: { teacherId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { id: true, slug: true, title: true, summary: true, subject: { select: { name: true, color: true } }, _count: { select: { lessons: true } } },
    }),
    viewer.id && viewer.role === "STUDENT"
      ? db.teacherConnection.findUnique({ where: { studentId_teacherId: { studentId: viewer.id, teacherId } }, select: { id: true, status: true } })
      : null,
    viewer.id && viewer.role === "STUDENT"
      ? db.savedTeacher.count({ where: { studentId: viewer.id, teacherId } }).then((n) => n > 0)
      : false,
    viewer.id && viewer.role === "STUDENT"
      ? db.tutoringSession.count({ where: { teacherId, status: "CONFIRMED", endsAt: { lte: now }, connection: { studentId: viewer.id } } }).then((n) => n > 0)
      : false,
    viewer.id && viewer.role === "STUDENT"
      ? db.teacherReview.findUnique({ where: { teacherId_studentId: { teacherId, studentId: viewer.id } }, select: { rating: true, body: true } })
      : null,
  ]);

  const intervals = typicalWeek(profile.availability, profile.timeZone, now);
  return {
    profile: {
      id: profile.id,
      slug: profile.slug,
      teacherId,
      name: profile.user.name,
      headline: profile.headline,
      about: profile.about,
      teachingStyle: profile.teachingStyle,
      experienceYears: profile.experienceYears,
      qualifications: profile.qualifications,
      videoUrl: profile.videoUrl,
      photo: photoUrl(profile),
      acceptingStudents: profile.acceptingStudents,
      sessionMinutes: profile.sessionMinutes,
      subjects: groupTopics(profile),
      languages: profile.languages.map((l) => l.language).sort(),
    },
    isListed: isListedNow,
    gaps: gapsOf(profile),
    isHidden: profile.isHidden,
    stats: stats.get(teacherId) ?? { average: null, reviewCount: 0, students: 0, sessionsTaught: 0 },
    timetable: weeklyTimetable(intervals, viewer.timeZone),
    hasAvailability: intervals.length > 0,
    nextSlot:
      nextAvailableSlot({ windows: profile.availability, timeZone: profile.timeZone, sessionMinutes: profile.sessionMinutes, now, busy: busy.get(teacherId) ?? [] })
        ?.start ?? null,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt, author: shortName(r.student.name) })),
    courses,
    viewerRelation: { connection, saved, canReview: hadSession, ownReview },
  };
}

/** Open slots with a teacher for a student, grouped by the student's local day. */
export async function getBookingSlots(teacherId: string, studentId: string, viewerTimeZone: string, now = new Date()) {
  const profile = await db.teacherProfile.findUnique({
    where: { userId: teacherId },
    select: { timeZone: true, sessionMinutes: true, availability: { select: { weekday: true, startMinute: true, endMinute: true } } },
  });
  if (!profile) return [];
  const busy = await busyIntervals(db, { teacherId, studentId }, now, new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * DAY));
  const slots = generateSlots({ windows: profile.availability, timeZone: profile.timeZone, sessionMinutes: profile.sessionMinutes, now, busy });
  return groupSlotsByDay(slots, viewerTimeZone);
}

export async function getProfileEditor(teacherId: string) {
  const profile = await db.teacherProfile.findUnique({
    where: { userId: teacherId },
    select: {
      ...profileSelect,
      meetingUrl: true,
    },
  });
  if (!profile) return null;
  const gaps = gapsOf(profile);
  return {
    profile: {
      ...profile,
      photoUrl: photoUrl(profile),
      topicIds: profile.topics.map((t) => t.topic.id),
      languageList: profile.languages.map((l) => l.language),
    },
    gaps,
    isListed: listed(profile),
  };
}

export async function getTeacherPhoto(profileId: string) {
  return db.profilePhoto.findUnique({
    where: { profileId },
    select: { data: true, contentType: true, updatedAt: true, profile: { select: { isHidden: true, userId: true } } },
  });
}
