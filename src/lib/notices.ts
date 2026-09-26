/**
 * Confirmation messages shown after a redirect (?notice=key). Only keys in
 * this list render, so the query string can't inject arbitrary text.
 */
export const NOTICES = {
  welcome: "Your account is ready. Pick a course from the catalog to get started.",
  enrolled: "Enrolled. Your first lesson is waiting below.",
  "course-created": "Course created as a draft. Add lessons, then submit it for review.",
  "lesson-added": "Lesson added.",
  "lesson-deleted": "Lesson deleted.",
  "assessment-created": "Created. Add questions or instructions, then publish it when it's ready.",
  "assessment-deleted": "Deleted.",
  marked: "Marked. The student can see their score and feedback now.",
} as const;

export type NoticeKey = keyof typeof NOTICES;

export function noticeFor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Object.hasOwn(NOTICES, value) ? NOTICES[value as NoticeKey] : null;
}
