import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { availableActions, submissionBlockers } from "@/lib/course-lifecycle";
import { db } from "@/server/db";
import { canManageCourse } from "@/server/services/guards";
import type { Actor } from "@/server/services/result";
import { summarizeCourse } from "./course-progress";

/** Courses an actor manages: their own if a teacher, everything if an admin. */
function managedWhere(actor: Actor): Prisma.CourseWhereInput {
  return actor.role === "ADMIN" ? {} : { teacherId: actor.id };
}

export async function getTeacherCourses(actor: Actor) {
  return db.course.findMany({
    where: managedWhere(actor),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      reviewNote: true,
      updatedAt: true,
      subject: { select: { name: true, color: true } },
      _count: { select: { lessons: true, enrollments: true, assessments: true } },
    },
  });
}

export async function getMarkingQueue(actor: Actor, limit = 50) {
  return db.submission.findMany({
    where: { status: "SUBMITTED", assessment: { kind: "ASSIGNMENT", course: managedWhere(actor) } },
    orderBy: { submittedAt: "asc" },
    take: limit,
    select: {
      id: true,
      submittedAt: true,
      student: { select: { name: true } },
      assessment: { select: { title: true, dueAt: true, course: { select: { id: true, title: true } } } },
    },
  });
}

export async function getRecentlyMarked(actor: Actor, limit = 10) {
  return db.submission.findMany({
    where: { status: "GRADED", gradedById: { not: null }, assessment: { kind: "ASSIGNMENT", course: managedWhere(actor) } },
    orderBy: { gradedAt: "desc" },
    take: limit,
    select: {
      id: true,
      score: true,
      maxScore: true,
      gradedAt: true,
      student: { select: { name: true } },
      assessment: { select: { title: true, passPercent: true, course: { select: { title: true } } } },
    },
  });
}

export async function getTeacherStats(actor: Actor) {
  const where = managedWhere(actor);
  const [students, published, awaiting] = await Promise.all([
    db.enrollment.findMany({ where: { course: where }, distinct: ["userId"], select: { userId: true } }),
    db.course.count({ where: { ...where, status: "PUBLISHED" } }),
    db.submission.count({ where: { status: "SUBMITTED", assessment: { kind: "ASSIGNMENT", course: where } } }),
  ]);
  return { students: students.length, published, awaiting };
}

export async function getCourseForEditor(actor: Actor, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      level: true,
      status: true,
      reviewNote: true,
      submittedAt: true,
      publishedAt: true,
      isFeatured: true,
      teacherId: true,
      subjectId: true,
      subject: { select: { name: true, color: true } },
      teacher: { select: { name: true } },
      lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, durationMinutes: true, videoUrl: true } },
      assessments: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          kind: true,
          isPublished: true,
          dueAt: true,
          _count: { select: { questions: true, submissions: true } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course || !canManageCourse(actor, course)) return null;
  return {
    course,
    actions: availableActions(course.status, actor.role),
    blockers: submissionBlockers({ lessonCount: course.lessons.length, description: course.description }),
  };
}

export async function getLessonForEditor(actor: Actor, courseId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, courseId },
    select: {
      id: true,
      title: true,
      body: true,
      videoUrl: true,
      durationMinutes: true,
      course: { select: { id: true, title: true, status: true, teacherId: true } },
    },
  });
  if (!lesson || !canManageCourse(actor, lesson.course)) return null;
  return lesson;
}

export async function getAssessmentForEditor(actor: Actor, courseId: string, assessmentId: string) {
  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, courseId },
    select: {
      id: true,
      title: true,
      instructions: true,
      kind: true,
      passPercent: true,
      maxPoints: true,
      dueAt: true,
      isPublished: true,
      course: { select: { id: true, title: true, status: true, teacherId: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          prompt: true,
          explanation: true,
          options: { orderBy: { position: "asc" }, select: { id: true, label: true, isCorrect: true } },
        },
      },
      _count: { select: { submissions: true } },
    },
  });
  if (!assessment || !canManageCourse(actor, assessment.course)) return null;
  return assessment;
}

export async function getCourseRoster(actor: Actor, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      teacherId: true,
      lessons: { orderBy: { position: "asc" }, select: { id: true } },
      assessments: {
        where: { isPublished: true },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          kind: true,
          passPercent: true,
          dueAt: true,
          submissions: {
            orderBy: { submittedAt: "desc" },
            select: { id: true, studentId: true, score: true, maxScore: true, status: true, submittedAt: true, feedback: true },
          },
        },
      },
      enrollments: {
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          completedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              lessonProgress: { where: { lesson: { courseId } }, select: { lessonId: true, completedAt: true } },
            },
          },
        },
      },
    },
  });
  if (!course || !canManageCourse(actor, course)) return null;

  const rows = course.enrollments.map(({ user, createdAt, completedAt }) => {
    const assessments = course.assessments.map((a) => ({ ...a, submissions: a.submissions.filter((s) => s.studentId === user.id) }));
    const summary = summarizeCourse({ lessons: course.lessons, assessments }, user.lessonProgress.map((p) => p.lessonId));
    const activity = [
      ...user.lessonProgress.map((p) => p.completedAt),
      ...assessments.flatMap((a) => a.submissions.map((s) => s.submittedAt)),
    ];
    const lastActive = activity.reduce<Date | null>((latest, d) => (!latest || d > latest ? d : latest), null);
    return { student: { id: user.id, name: user.name, email: user.email }, enrolledAt: createdAt, completedAt, summary, lastActive };
  });
  return { course: { id: course.id, title: course.title, lessonCount: course.lessons.length }, rows };
}

export async function getCourseAnnouncements(actor: Actor, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, teacherId: true } });
  if (!course || !canManageCourse(actor, course)) return null;
  const announcements = await db.announcement.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, createdAt: true, author: { select: { name: true } } },
  });
  return { course, announcements };
}

export async function getSubmissionForMarking(actor: Actor, submissionId: string) {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      response: true,
      score: true,
      maxScore: true,
      status: true,
      feedback: true,
      submittedAt: true,
      gradedAt: true,
      student: { select: { name: true, email: true } },
      gradedBy: { select: { name: true } },
      assessment: {
        select: {
          id: true,
          title: true,
          instructions: true,
          kind: true,
          passPercent: true,
          course: { select: { id: true, title: true, teacherId: true } },
        },
      },
    },
  });
  if (!submission || !canManageCourse(actor, submission.assessment.course)) return null;
  return submission;
}

/** Platform announcements addressed to teachers. */
export async function getTeacherAnnouncements(limit = 5) {
  return db.announcement.findMany({
    where: { courseId: null, audience: { in: ["EVERYONE", "TEACHERS"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, body: true, createdAt: true, author: { select: { name: true } } },
  });
}

export async function getOwnApplication(userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { createdAt: true, applicationNote: true, applicationSubject: { select: { name: true } } },
  });
}
