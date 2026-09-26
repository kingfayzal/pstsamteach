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
  "course-submitted": "Submitted for review. An admin will check it and publish it or send notes back.",
  "course-withdrawn": "Withdrawn from review. You can edit it again.",
  "course-approved": "Approved and published. It's in the catalog now.",
  "course-rejected": "Sent back to the teacher with your notes.",
  "course-unpublished": "Unpublished. It's back in draft and out of the catalog.",
  "course-archived": "Archived. Enrolled students keep access; nobody new can enrol.",
  "course-restored": "Restored to the catalog.",
  "teacher-approved": "Approved. They can create courses now.",
  "teacher-declined": "Declined. Their account now works as a student account.",
} as const;

export type NoticeKey = keyof typeof NOTICES;

export function noticeFor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Object.hasOwn(NOTICES, value) ? NOTICES[value as NoticeKey] : null;
}
