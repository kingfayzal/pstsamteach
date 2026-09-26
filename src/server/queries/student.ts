import "server-only";
import { db } from "@/server/db";
import { progressSelect, summarizeCourse } from "./course-progress";

async function completedLessonIds(userId: string, courseIds?: string[]): Promise<string[]> {
  const rows = await db.lessonProgress.findMany({
    where: { userId, ...(courseIds ? { lesson: { courseId: { in: courseIds } } } : {}) },
    select: { lessonId: true },
  });
  return rows.map((r) => r.lessonId);
}

const LIVE_STATUSES = ["PUBLISHED", "ARCHIVED"] as const;

export async function getStudentCourses(userId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { userId, course: { status: { in: [...LIVE_STATUSES] } } },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      completedAt: true,
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          subject: { select: { name: true, color: true, slug: true } },
          teacher: { select: { name: true } },
          ...progressSelect(userId),
        },
      },
    },
  });
  const completed = await completedLessonIds(userId, enrollments.map((e) => e.course.id));
  return enrollments.map((enrollment) => ({
    ...enrollment,
    summary: summarizeCourse(enrollment.course, completed),
  }));
}

export async function getStudentAnnouncements(userId: string, limit = 5) {
  return db.announcement.findMany({
    where: {
      OR: [
        { courseId: null, audience: { in: ["EVERYONE", "STUDENTS"] } },
        { course: { enrollments: { some: { userId } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      course: { select: { title: true, slug: true } },
      author: { select: { name: true } },
    },
  });
}

export async function getRecentResults(userId: string, limit = 5) {
  return db.submission.findMany({
    where: { studentId: userId, status: "GRADED" },
    orderBy: { gradedAt: "desc" },
    take: limit,
    select: {
      id: true,
      score: true,
      maxScore: true,
      gradedAt: true,
      feedback: true,
      assessment: {
        select: { id: true, title: true, kind: true, passPercent: true, course: { select: { title: true, slug: true } } },
      },
    },
  });
}

export async function getStudentCourse(userId: string, slug: string) {
  const course = await db.course.findFirst({
    where: { slug, status: { in: [...LIVE_STATUSES] }, enrollments: { some: { userId } } },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      subject: { select: { name: true, color: true, slug: true } },
      teacher: { select: { name: true } },
      announcements: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, body: true, createdAt: true },
      },
      ...progressSelect(userId),
    },
  });
  if (!course) return null;
  const completed = await completedLessonIds(userId, [course.id]);
  return { course, summary: summarizeCourse(course, completed) };
}

export async function getStudentLesson(userId: string, slug: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({
    where: {
      id: lessonId,
      course: { slug, status: { in: [...LIVE_STATUSES] }, enrollments: { some: { userId } } },
    },
    select: {
      id: true,
      title: true,
      body: true,
      videoUrl: true,
      durationMinutes: true,
      position: true,
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          subject: { select: { name: true, color: true } },
          lessons: { orderBy: { position: "asc" }, select: { id: true, title: true } },
        },
      },
    },
  });
  if (!lesson) return null;
  const completed = new Set(await completedLessonIds(userId, [lesson.course.id]));
  const index = lesson.course.lessons.findIndex((l) => l.id === lesson.id);
  return {
    lesson,
    isComplete: completed.has(lesson.id),
    completedIds: completed,
    previous: lesson.course.lessons[index - 1] ?? null,
    next: lesson.course.lessons[index + 1] ?? null,
  };
}

export async function getStudentAssessment(userId: string, slug: string, assessmentId: string) {
  const assessment = await db.assessment.findFirst({
    where: {
      id: assessmentId,
      isPublished: true,
      course: { slug, status: { in: [...LIVE_STATUSES] }, enrollments: { some: { userId } } },
    },
    select: {
      id: true,
      title: true,
      instructions: true,
      kind: true,
      passPercent: true,
      maxPoints: true,
      dueAt: true,
      course: { select: { id: true, slug: true, title: true, status: true, subject: { select: { name: true, color: true } } } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          prompt: true,
          explanation: true,
          options: { orderBy: { position: "asc" }, select: { id: true, label: true, isCorrect: true } },
        },
      },
      submissions: {
        where: { studentId: userId },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          answers: true,
          response: true,
          score: true,
          maxScore: true,
          status: true,
          feedback: true,
          submittedAt: true,
          gradedAt: true,
        },
      },
    },
  });
  return assessment;
}

export async function getStudentGrades(userId: string) {
  return db.submission.findMany({
    where: { studentId: userId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      score: true,
      maxScore: true,
      status: true,
      submittedAt: true,
      gradedAt: true,
      feedback: true,
      assessment: {
        select: {
          id: true,
          title: true,
          kind: true,
          passPercent: true,
          course: { select: { title: true, slug: true, subject: { select: { name: true, color: true } } } },
        },
      },
    },
  });
}
