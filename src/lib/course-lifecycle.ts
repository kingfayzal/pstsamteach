import type { CourseStatus, Role } from "@/generated/prisma/enums";

export type CourseAction = "submit" | "withdraw" | "approve" | "reject" | "unpublish" | "archive" | "restore";

type Transition = { from: CourseStatus; to: CourseStatus; roles: readonly Role[] };

const TRANSITIONS: Readonly<Record<CourseAction, Transition>> = {
  submit: { from: "DRAFT", to: "IN_REVIEW", roles: ["TEACHER"] },
  withdraw: { from: "IN_REVIEW", to: "DRAFT", roles: ["TEACHER"] },
  approve: { from: "IN_REVIEW", to: "PUBLISHED", roles: ["ADMIN"] },
  reject: { from: "IN_REVIEW", to: "DRAFT", roles: ["ADMIN"] },
  unpublish: { from: "PUBLISHED", to: "DRAFT", roles: ["ADMIN"] },
  archive: { from: "PUBLISHED", to: "ARCHIVED", roles: ["ADMIN"] },
  restore: { from: "ARCHIVED", to: "PUBLISHED", roles: ["ADMIN"] },
};

const ACTION_ORDER: readonly CourseAction[] = ["submit", "withdraw", "approve", "reject", "unpublish", "archive", "restore"];

export const STATUS_LABEL: Readonly<Record<CourseStatus, string>> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const STATUS_PHRASE: Readonly<Record<CourseStatus, string>> = {
  DRAFT: "A draft course",
  IN_REVIEW: "A course in review",
  PUBLISHED: "A published course",
  ARCHIVED: "An archived course",
};

const ACTION_PAST: Readonly<Record<CourseAction, string>> = {
  submit: "submitted for review",
  withdraw: "withdrawn",
  approve: "approved",
  reject: "sent back",
  unpublish: "unpublished",
  archive: "archived",
  restore: "restored",
};

export type TransitionResult = { ok: true; status: CourseStatus } | { ok: false; error: string };

export function transitionCourse(status: CourseStatus, action: CourseAction, role: Role): TransitionResult {
  const transition = TRANSITIONS[action];
  if (!transition.roles.includes(role)) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  if (transition.from !== status) {
    return { ok: false, error: `${STATUS_PHRASE[status]} can't be ${ACTION_PAST[action]}.` };
  }
  return { ok: true, status: transition.to };
}

export function availableActions(status: CourseStatus, role: Role): CourseAction[] {
  return ACTION_ORDER.filter((action) => transitionCourse(status, action, role).ok);
}

/** Teachers can't change content while an admin is reviewing it, or once it's archived. */
export function canTeacherEditContent(status: CourseStatus): boolean {
  return status === "DRAFT" || status === "PUBLISHED";
}

export const MIN_DESCRIPTION_FOR_REVIEW = 80;

export function submissionBlockers(course: { lessonCount: number; description: string }): string[] {
  const blockers: string[] = [];
  if (course.lessonCount < 1) blockers.push("Add at least one lesson.");
  if (course.description.trim().length < MIN_DESCRIPTION_FOR_REVIEW) {
    blockers.push(`Write a course description of at least ${MIN_DESCRIPTION_FOR_REVIEW} characters.`);
  }
  return blockers;
}
