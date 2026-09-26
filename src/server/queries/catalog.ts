import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export async function listActiveSubjects() {
  return db.subject.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      color: true,
      _count: { select: { courses: { where: { status: "PUBLISHED" } } } },
    },
  });
}

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  level: true,
  isFeatured: true,
  subject: { select: { name: true, slug: true, color: true } },
  teacher: { select: { name: true } },
  _count: { select: { lessons: true, enrollments: true } },
} satisfies Prisma.CourseSelect;

export type CourseCard = Prisma.CourseGetPayload<{ select: typeof cardSelect }>;

export async function listCatalog(filters: { subject?: string; q?: string }): Promise<CourseCard[]> {
  const q = filters.q?.trim().slice(0, 80);
  return db.course.findMany({
    where: {
      status: "PUBLISHED",
      subject: { isActive: true, ...(filters.subject ? { slug: filters.subject } : {}) },
      ...(q ? { OR: [{ title: { contains: q } }, { summary: { contains: q } }] } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    select: cardSelect,
    take: 60,
  });
}

export async function listFeaturedCourses(limit = 6): Promise<CourseCard[]> {
  const featured = await db.course.findMany({
    where: { status: "PUBLISHED", subject: { isActive: true } },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    select: cardSelect,
    take: limit,
  });
  return featured;
}

export async function getPublicCourse(slug: string) {
  return db.course.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      level: true,
      publishedAt: true,
      subject: { select: { name: true, slug: true, color: true } },
      teacher: { select: { name: true, bio: true, teacherProfile: { select: { slug: true, headline: true, isHidden: true } } } },
      lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, durationMinutes: true } },
      assessments: {
        where: { isPublished: true },
        orderBy: { position: "asc" },
        select: { id: true, title: true, kind: true },
      },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  return (await db.enrollment.count({ where: { userId, courseId } })) > 0;
}
