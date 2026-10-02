export type SeedQuestion = { prompt: string; options: string[]; correct: number; explanation?: string };

export type SeedAssessment =
  | { kind: "QUIZ"; title: string; instructions: string; passPercent: number; questions: SeedQuestion[] }
  | { kind: "ASSIGNMENT"; title: string; instructions: string; passPercent: number; maxPoints: number; dueInDays?: number };

export type SeedLesson = { title: string; minutes: number; body: string; videoUrl?: string };

export type SeedCourse = {
  key: string;
  subject: "english" | "mathematics" | "nursing" | "yoruba" | "music";
  teacher: "grace" | "daniel" | "ruth" | "bisi" | "femi";
  title: string;
  summary: string;
  description: string;
  level: "FOUNDATION" | "INTERMEDIATE" | "ADVANCED";
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED";
  featured?: boolean;
  lessons: SeedLesson[];
  assessments: SeedAssessment[];
};
