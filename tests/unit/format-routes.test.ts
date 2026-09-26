import { describe, expect, it } from "vitest";
import { formatDate, formatMinutes, formatRelative, plural, toDateTimeLocal } from "@/lib/format";
import { homePathFor, safeNextPath } from "@/lib/routes";

describe("safeNextPath", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/learn/courses/algebra")).toBe("/learn/courses/algebra");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "learn", 42, null])("rejects %s", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});

describe("homePathFor", () => {
  it("sends each role to its area", () => {
    expect(homePathFor({ role: "STUDENT", status: "ACTIVE" })).toBe("/learn");
    expect(homePathFor({ role: "TEACHER", status: "ACTIVE" })).toBe("/teach");
    expect(homePathFor({ role: "TEACHER", status: "PENDING" })).toBe("/teach/pending");
    expect(homePathFor({ role: "ADMIN", status: "ACTIVE" })).toBe("/admin");
  });
});

describe("format helpers", () => {
  it("formats minutes as hours when long", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(95)).toBe("1 hr 35 min");
  });

  it("pluralises", () => {
    expect(plural(1, "lesson")).toBe("1 lesson");
    expect(plural(3, "lesson")).toBe("3 lessons");
    expect(plural(2, "quiz", "quizzes")).toBe("2 quizzes");
  });

  it("formats relative times", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    expect(formatRelative(new Date("2026-09-26T11:59:30Z"), now)).toBe("just now");
    expect(formatRelative(new Date("2026-09-24T12:00:00Z"), now)).toBe("2 days ago");
    expect(formatRelative(new Date("2026-09-27T12:00:00Z"), now)).toBe("tomorrow");
  });

  it("formats dates and handles empties", () => {
    expect(formatDate(new Date("2026-09-26T12:00:00Z"))).toBe("26 Sept 2026");
    expect(formatDate(null)).toBe("");
    expect(toDateTimeLocal(null)).toBe("");
    expect(toDateTimeLocal(new Date("2026-09-26T12:00:00"))).toBe("2026-09-26T12:00");
  });
});
