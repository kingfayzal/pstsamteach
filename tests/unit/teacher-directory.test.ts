import { describe, expect, it } from "vitest";
import {
  isListed,
  parseDirectoryFilters,
  profileGaps,
  rankingScore,
  ratingSummary,
  sortTeachers,
} from "@/lib/teacher-directory";
import { detectImageType } from "@/lib/images";

const complete = { headline: "Nurse educator", about: "a".repeat(80), topicCount: 1, languageCount: 1, windowCount: 1 };

describe("profileGaps", () => {
  it("is empty for a complete profile", () => {
    expect(profileGaps(complete)).toEqual([]);
  });

  it("names everything that's missing", () => {
    expect(profileGaps({ headline: " ", about: "short", topicCount: 0, languageCount: 0, windowCount: 0 })).toEqual([
      "Add a headline.",
      "Write at least 80 characters about yourself.",
      "Choose at least one topic you teach.",
      "Add a language you teach in.",
      "Set your weekly availability.",
    ]);
  });
});

describe("isListed", () => {
  it("lists only complete, visible, active teachers", () => {
    expect(isListed({ gaps: [], isHidden: false, role: "TEACHER", status: "ACTIVE" })).toBe(true);
    expect(isListed({ gaps: ["Add a headline."], isHidden: false, role: "TEACHER", status: "ACTIVE" })).toBe(false);
    expect(isListed({ gaps: [], isHidden: true, role: "TEACHER", status: "ACTIVE" })).toBe(false);
    expect(isListed({ gaps: [], isHidden: false, role: "TEACHER", status: "SUSPENDED" })).toBe(false);
    expect(isListed({ gaps: [], isHidden: false, role: "STUDENT", status: "ACTIVE" })).toBe(false);
  });
});

describe("ratings", () => {
  it("averages to one decimal place", () => {
    expect(ratingSummary([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
    expect(ratingSummary([])).toEqual({ average: null, count: 0 });
  });

  it("pulls small samples towards the middle", () => {
    expect(rankingScore(5, 1)).toBeLessThan(rankingScore(4.8, 20));
    expect(rankingScore(null, 0)).toBe(4);
  });
});

describe("sortTeachers", () => {
  const row = (name: string, extra: Partial<Parameters<typeof sortTeachers>[0][number]>) => ({
    name,
    average: null,
    reviewCount: 0,
    students: 0,
    createdAt: new Date("2026-01-01"),
    acceptingStudents: true,
    ...extra,
  });
  const rows = [
    row("new", { createdAt: new Date("2026-09-01") }),
    row("popular", { students: 30, average: 4.6, reviewCount: 12 }),
    row("full", { acceptingStudents: false, average: 5, reviewCount: 40, students: 50 }),
    row("rated", { average: 4.9, reviewCount: 25, students: 10 }),
  ];

  it("recommends teachers taking students, then the best rated", () => {
    expect(sortTeachers(rows, "recommended").map((r) => r.name)).toEqual(["rated", "popular", "new", "full"]);
  });

  it("sorts by rating, students and newest", () => {
    expect(sortTeachers(rows, "rating").map((r) => r.name)).toEqual(["full", "rated", "popular", "new"]);
    expect(sortTeachers(rows, "students").map((r) => r.name)).toEqual(["full", "popular", "rated", "new"]);
    expect(sortTeachers(rows, "newest")[0].name).toBe("new");
  });

  it("does not mutate the input", () => {
    const frozen = Object.freeze([...rows]);
    expect(() => sortTeachers(frozen, "rating")).not.toThrow();
  });
});

describe("parseDirectoryFilters", () => {
  it("reads valid filters and drops junk", () => {
    expect(
      parseDirectoryFilters({ subject: "nursing", topic: "dosage-calculations", language: "Yoruba", day: "1", time: "evening", q: "  ruth ", accepting: "1", sort: "rating" }),
    ).toEqual({
      subject: "nursing",
      topic: "dosage-calculations",
      language: "Yoruba",
      weekday: 1,
      band: "evening",
      q: "ruth",
      accepting: true,
      saved: false,
      sort: "rating",
    });
    expect(parseDirectoryFilters({ day: "9", time: "brunch", sort: "cheapest", language: "Klingon", subject: ["a", "b"] })).toEqual({
      subject: "a",
      topic: undefined,
      language: undefined,
      weekday: undefined,
      band: undefined,
      q: undefined,
      accepting: false,
      saved: false,
      sort: "recommended",
    });
  });
});

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP by their bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF____WEBPVP8 ");
    expect(detectImageType(webp)).toBe("image/webp");
  });

  it("rejects anything else, including SVG and renamed files", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});
