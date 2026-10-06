/**
 * Confirmation messages shown after a redirect (?notice=key). Only keys in
 * this list render, so the query string can't inject arbitrary text.
 */
export const NOTICES = {
  "email-confirmed": "Email address confirmed. Your account is ready.",
  "email-changed": "Address changed. We've sent a new link to it.",
  "password-reset": "Password changed. You're signed in, and every other device has been signed out.",
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
  "request-sent": "Request sent. Your teacher will reply here, usually within a day or two.",
  "request-accepted": "Accepted. You're now working together, and any requested session is confirmed.",
  "request-declined": "Declined. The student can see your note.",
  "request-withdrawn": "Request withdrawn.",
  "connection-ended": "You're no longer working together. Future sessions were cancelled.",
  "session-booked": "Session booked. It's in your upcoming sessions below.",
  "session-cancelled": "Session cancelled.",
  "profile-created": "Your teacher profile is ready to fill in. Students will see it once it's complete.",
} as const;

export type NoticeKey = keyof typeof NOTICES;

export function noticeFor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Object.hasOwn(NOTICES, value) ? NOTICES[value as NoticeKey] : null;
}
