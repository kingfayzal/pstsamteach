import type { Role, UserStatus } from "@/generated/prisma/enums";
import { isLanguage } from "./languages";
import { TIME_BANDS, type BandKey } from "./scheduling";

export const MIN_ABOUT_FOR_LISTING = 80;

export type ListingFacts = {
  headline: string;
  about: string;
  topicCount: number;
  languageCount: number;
  windowCount: number;
};

/** What a teacher still needs to add before their profile appears in the directory. */
export function profileGaps(profile: ListingFacts): string[] {
  const gaps: string[] = [];
  if (!profile.headline.trim()) gaps.push("Add a headline.");
  if (profile.about.trim().length < MIN_ABOUT_FOR_LISTING) gaps.push(`Write at least ${MIN_ABOUT_FOR_LISTING} characters about yourself.`);
  if (profile.topicCount < 1) gaps.push("Choose at least one topic you teach.");
  if (profile.languageCount < 1) gaps.push("Add a language you teach in.");
  if (profile.windowCount < 1) gaps.push("Set your weekly availability.");
  return gaps;
}

export function isListed(facts: { gaps: readonly string[]; isHidden: boolean; role: Role; status: UserStatus }): boolean {
  return facts.gaps.length === 0 && !facts.isHidden && facts.role === "TEACHER" && facts.status === "ACTIVE";
}

export function ratingSummary(ratings: readonly number[]): { average: number | null; count: number } {
  if (ratings.length === 0) return { average: null, count: 0 };
  const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { average: Math.round(mean * 10) / 10, count: ratings.length };
}

const PRIOR_MEAN = 4;
const PRIOR_WEIGHT = 3;

/** Bayesian average, so one five-star review doesn't outrank twenty good ones. */
export function rankingScore(average: number | null, count: number): number {
  if (!average || count === 0) return PRIOR_MEAN;
  return (PRIOR_MEAN * PRIOR_WEIGHT + average * count) / (PRIOR_WEIGHT + count);
}

export const DIRECTORY_SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "students", label: "Most students" },
  { value: "newest", label: "Newest" },
] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number]["value"];

type Sortable = {
  average: number | null;
  reviewCount: number;
  students: number;
  createdAt: Date;
  acceptingStudents: boolean;
};

const byRating = (a: Sortable, b: Sortable) => (b.average ?? -1) - (a.average ?? -1) || b.reviewCount - a.reviewCount;

export function sortTeachers<T extends Sortable>(rows: readonly T[], sort: DirectorySort): T[] {
  const copy = [...rows];
  switch (sort) {
    case "rating":
      return copy.sort(byRating);
    case "students":
      return copy.sort((a, b) => b.students - a.students || byRating(a, b));
    case "newest":
      return copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    default:
      return copy.sort(
        (a, b) =>
          Number(b.acceptingStudents) - Number(a.acceptingStudents) ||
          rankingScore(b.average, b.reviewCount) - rankingScore(a.average, a.reviewCount) ||
          b.students - a.students,
      );
  }
}

export type DirectoryFilters = {
  subject?: string;
  topic?: string;
  language?: string;
  weekday?: number;
  band?: BandKey;
  q?: string;
  accepting: boolean;
  saved: boolean;
  sort: DirectorySort;
};

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const slugLike = (value: string | undefined) => (value && /^[a-z0-9-]{1,60}$/.test(value) ? value : undefined);

/** Read directory filters from the query string, ignoring anything invalid. */
export function parseDirectoryFilters(params: Params): DirectoryFilters {
  const day = Number(first(params.day));
  const band = first(params.time);
  const sort = first(params.sort);
  const language = first(params.language);
  const q = first(params.q)?.trim().slice(0, 80);
  return {
    subject: slugLike(first(params.subject)),
    topic: slugLike(first(params.topic)),
    language: isLanguage(language) ? language : undefined,
    weekday: first(params.day) !== undefined && Number.isInteger(day) && day >= 0 && day <= 6 ? day : undefined,
    band: TIME_BANDS.some((b) => b.key === band) ? (band as BandKey) : undefined,
    q: q || undefined,
    accepting: first(params.accepting) === "1",
    saved: first(params.saved) === "1",
    sort: DIRECTORY_SORTS.some((s) => s.value === sort) ? (sort as DirectorySort) : "recommended",
  };
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** Monday-first order for timetables and editors. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
