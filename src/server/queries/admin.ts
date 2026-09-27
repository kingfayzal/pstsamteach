import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CourseStatus, Role, UserStatus } from "@/generated/prisma/enums";
import { bucketSignups } from "@/lib/signups";
import { isListed, profileGaps } from "@/lib/teacher-directory";
import { db } from "@/server/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAdminOverview() {
  const since = new Date(Date.now() - 14 * DAY_MS);
  const [students, teachers, pendingTeachers, courseGroups, enrollments, submissionsWeek, awaitingMarking, signups, reviewQueue, pending, audit] =
    await Promise.all([
      db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
      db.user.count({ where: { role: "TEACHER", status: "ACTIVE" } }),
      db.user.count({ where: { role: "TEACHER", status: "PENDING" } }),
      db.course.groupBy({ by: ["status"], _count: { _all: true } }),
      db.enrollment.count(),
      db.submission.count({ where: { submittedAt: { gte: new Date(Date.now() - 7 * DAY_MS) } } }),
      db.submission.count({ where: { status: "SUBMITTED" } }),
      db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, role: true } }),
      db.course.findMany({
        where: { status: "IN_REVIEW" },
        orderBy: { submittedAt: "asc" },
        take: 8,
        select: { id: true, title: true, submittedAt: true, teacher: { select: { name: true } }, subject: { select: { name: true, color: true } } },
      }),
      db.user.findMany({
        where: { role: "TEACHER", status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 8,
        select: { id: true, name: true, createdAt: true, applicationSubject: { select: { name: true } } },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, summary: true, createdAt: true, actor: { select: { name: true } } },
      }),
    ]);

  const byStatus = Object.fromEntries(courseGroups.map((g) => [g.status, g._count._all])) as Partial<Record<CourseStatus, number>>;
  return {
    counts: { students, teachers, pendingTeachers, enrollments, submissionsWeek, awaitingMarking, courses: byStatus },
    signups: bucketSignups(signups, 14),
    reviewQueue,
    pending,
    audit,
  };
}

export async function getReviewQueue() {
  const [courses, applicants] = await Promise.all([
    db.course.findMany({
      where: { status: "IN_REVIEW" },
      orderBy: { submittedAt: "asc" },
      select: {
        id: true,
        title: true,
        summary: true,
        submittedAt: true,
        teacher: { select: { name: true } },
        subject: { select: { name: true, color: true } },
        _count: { select: { lessons: true, assessments: true } },
      },
    }),
    db.user.findMany({
      where: { role: "TEACHER", status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, applicationNote: true, createdAt: true, applicationSubject: { select: { name: true, color: true } } },
    }),
  ]);
  return { courses, applicants };
}

type UserFilters = { q?: string; role?: string; status?: string };

const ROLES: readonly Role[] = ["STUDENT", "TEACHER", "ADMIN"];
const STATUSES: readonly UserStatus[] = ["ACTIVE", "PENDING", "SUSPENDED"];

export async function listUsers(filters: UserFilters) {
  const q = filters.q?.trim().slice(0, 80);
  const role = ROLES.find((r) => r === filters.role);
  const status = STATUSES.find((s) => s === filters.status);
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q.toLowerCase(), mode: "insensitive" } }] } : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { enrollments: true, courses: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return { users, total };
}

export async function getUserDetail(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      bio: true,
      applicationNote: true,
      applicationSubject: { select: { name: true } },
      createdAt: true,
      lastLoginAt: true,
      courses: { orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, _count: { select: { enrollments: true } } } },
      enrollments: {
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, completedAt: true, course: { select: { id: true, title: true, slug: true } } },
      },
      _count: { select: { submissions: true } },
    },
  });
}

const COURSE_STATUSES: readonly CourseStatus[] = ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"];

export async function listAllCourses(filters: { status?: string; q?: string; subject?: string }) {
  const q = filters.q?.trim().slice(0, 80);
  const status = COURSE_STATUSES.find((s) => s === filters.status);
  return db.course.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(filters.subject ? { subject: { slug: filters.subject } } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { teacher: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      isFeatured: true,
      updatedAt: true,
      teacher: { select: { name: true } },
      subject: { select: { name: true, color: true } },
      _count: { select: { lessons: true, enrollments: true } },
    },
  });
}

export async function getCourseForReview(courseId: string) {
  return db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      level: true,
      status: true,
      isFeatured: true,
      reviewNote: true,
      submittedAt: true,
      publishedAt: true,
      teacher: { select: { id: true, name: true, email: true } },
      subject: { select: { name: true, color: true } },
      lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, body: true, videoUrl: true, durationMinutes: true } },
      assessments: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          instructions: true,
          kind: true,
          isPublished: true,
          passPercent: true,
          maxPoints: true,
          questions: {
            orderBy: { position: "asc" },
            select: { id: true, prompt: true, options: { orderBy: { position: "asc" }, select: { id: true, label: true, isCorrect: true } } },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function listSubjectsWithCounts() {
  return db.subject.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      description: true,
      color: true,
      isActive: true,
      _count: { select: { courses: true } },
      topics: { orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, _count: { select: { teachers: true } } } },
    },
  });
}

export async function listPlatformAnnouncements() {
  return db.announcement.findMany({
    where: { courseId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, audience: true, createdAt: true, author: { select: { name: true } } },
  });
}

export const AUDIT_PAGE_SIZE = 50;

export async function listAudit(page: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: { id: true, action: true, summary: true, createdAt: true, actor: { select: { name: true } } },
    }),
    db.auditLog.count(),
  ]);
  return { entries, total, page: safePage, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

export async function getReviewCount(): Promise<number> {
  const [courses, applicants] = await Promise.all([
    db.course.count({ where: { status: "IN_REVIEW" } }),
    db.user.count({ where: { role: "TEACHER", status: "PENDING" } }),
  ]);
  return courses + applicants;
}

/** Every teacher profile with its directory status, for moderation. */
export async function listTeacherProfilesForAdmin() {
  const profiles = await db.teacherProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      headline: true,
      about: true,
      isHidden: true,
      acceptingStudents: true,
      user: { select: { id: true, name: true, status: true, role: true } },
      _count: { select: { topics: true, languages: true, availability: true } },
    },
  });
  const teacherIds = profiles.map((p) => p.user.id);
  const [reviews, active, pending] = await Promise.all([
    db.teacherReview.groupBy({ by: ["teacherId"], where: { teacherId: { in: teacherIds }, isHidden: false }, _avg: { rating: true }, _count: { _all: true } }),
    db.teacherConnection.groupBy({ by: ["teacherId"], where: { teacherId: { in: teacherIds }, status: "ACTIVE" }, _count: { _all: true } }),
    db.teacherConnection.groupBy({ by: ["teacherId"], where: { teacherId: { in: teacherIds }, status: "PENDING" }, _count: { _all: true } }),
  ]);
  return profiles.map((p) => {
    const gaps = profileGaps({
      headline: p.headline,
      about: p.about,
      topicCount: p._count.topics,
      languageCount: p._count.languages,
      windowCount: p._count.availability,
    });
    const r = reviews.find((x) => x.teacherId === p.user.id);
    return {
      ...p,
      gaps,
      listed: isListed({ gaps, isHidden: p.isHidden, role: p.user.role, status: p.user.status }),
      average: r?._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null,
      reviewCount: r?._count._all ?? 0,
      activeStudents: active.find((x) => x.teacherId === p.user.id)?._count._all ?? 0,
      pendingRequests: pending.find((x) => x.teacherId === p.user.id)?._count._all ?? 0,
    };
  });
}

/** A teacher's profile flags and every review (including hidden ones), for the people page. */
export async function getTeacherModeration(teacherId: string) {
  const profile = await db.teacherProfile.findUnique({
    where: { userId: teacherId },
    select: { id: true, slug: true, isHidden: true, acceptingStudents: true },
  });
  if (!profile) return null;
  const reviews = await db.teacherReview.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
    select: { id: true, rating: true, body: true, isHidden: true, createdAt: true, student: { select: { name: true } } },
  });
  return { profile, reviews };
}

export async function getTutoringOverview(now = new Date()) {
  const weekAhead = new Date(now.getTime() + 7 * DAY_MS);
  const [activePairs, pendingRequests, sessionsThisWeek] = await Promise.all([
    db.teacherConnection.count({ where: { status: "ACTIVE" } }),
    db.teacherConnection.count({ where: { status: "PENDING" } }),
    db.tutoringSession.count({ where: { status: "CONFIRMED", startsAt: { gte: now, lt: weekAhead } } }),
  ]);
  return { activePairs, pendingRequests, sessionsThisWeek };
}
