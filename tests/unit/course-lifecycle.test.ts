import { describe, expect, it } from "vitest";
import {
  availableActions,
  canTeacherEditContent,
  submissionBlockers,
  transitionCourse,
} from "@/lib/course-lifecycle";

describe("transitionCourse", () => {
  it("lets a teacher submit a draft for review", () => {
    expect(transitionCourse("DRAFT", "submit", "TEACHER")).toEqual({ ok: true, status: "IN_REVIEW" });
  });

  it("lets an admin approve a course in review", () => {
    expect(transitionCourse("IN_REVIEW", "approve", "ADMIN")).toEqual({ ok: true, status: "PUBLISHED" });
  });

  it("sends a rejected course back to draft", () => {
    expect(transitionCourse("IN_REVIEW", "reject", "ADMIN")).toEqual({ ok: true, status: "DRAFT" });
  });

  it("archives and restores published courses", () => {
    expect(transitionCourse("PUBLISHED", "archive", "ADMIN")).toEqual({ ok: true, status: "ARCHIVED" });
    expect(transitionCourse("ARCHIVED", "restore", "ADMIN")).toEqual({ ok: true, status: "PUBLISHED" });
  });

  it("refuses a teacher approving their own course", () => {
    const result = transitionCourse("IN_REVIEW", "approve", "TEACHER");
    expect(result.ok).toBe(false);
  });

  it("refuses an action from the wrong status", () => {
    const result = transitionCourse("DRAFT", "approve", "ADMIN");
    expect(result).toEqual({ ok: false, error: "A draft course can't be approved." });
  });

  it("refuses students entirely", () => {
    expect(transitionCourse("DRAFT", "submit", "STUDENT").ok).toBe(false);
  });
});

describe("availableActions", () => {
  it("lists what a teacher can do with a draft", () => {
    expect(availableActions("DRAFT", "TEACHER")).toEqual(["submit"]);
  });

  it("lists what an admin can do with a course in review", () => {
    expect(availableActions("IN_REVIEW", "ADMIN")).toEqual(["approve", "reject"]);
  });

  it("gives students nothing", () => {
    expect(availableActions("PUBLISHED", "STUDENT")).toEqual([]);
  });
});

describe("canTeacherEditContent", () => {
  it("locks the course while it is being reviewed or archived", () => {
    expect(canTeacherEditContent("DRAFT")).toBe(true);
    expect(canTeacherEditContent("PUBLISHED")).toBe(true);
    expect(canTeacherEditContent("IN_REVIEW")).toBe(false);
    expect(canTeacherEditContent("ARCHIVED")).toBe(false);
  });
});

describe("submissionBlockers", () => {
  it("requires at least one lesson and a real description", () => {
    expect(submissionBlockers({ lessonCount: 0, description: "short" })).toEqual([
      "Add at least one lesson.",
      "Write a course description of at least 80 characters.",
    ]);
  });

  it("returns nothing for a ready course", () => {
    expect(submissionBlockers({ lessonCount: 2, description: "x".repeat(80) })).toEqual([]);
  });
});
