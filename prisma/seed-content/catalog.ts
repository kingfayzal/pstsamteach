/**
 * The subjects and topics Xcel Study offers (set 2026-10-06). The migration
 * 20261006120000_subject_catalog adds exactly this to every database, once, and
 * the seed builds local data from it. Changing the catalog later needs a new
 * migration, not an edit here: tests/integration/subject-catalog.test.ts checks
 * the migration against this list.
 *
 * Subject colours carry information, so each is distinct from the others and
 * from marking green, and reads at AA contrast on paper.
 */
export type CatalogSubject = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  color: string;
  topics: readonly string[];
};

export const CATALOG: readonly CatalogSubject[] = [
  {
    slug: "mathematics",
    name: "Mathematics",
    tagline: "Number, algebra and problem solving",
    description: "Work from the foundations up: arithmetic, algebra and the reasoning behind every step.",
    color: "#2356C2",
    topics: [
      "Basic Math",
      "Algebra I & II",
      "Geometry",
      "Trigonometry",
      "Calculus",
      "Statistics",
      "Advanced Placement (AP) Math",
      "International Baccalaureate (IB) Math",
      "Other",
    ],
  },
  {
    slug: "english",
    name: "English",
    tagline: "Grammar, writing and reading with purpose",
    description: "Clear, correct writing, from sentence structure and punctuation to essays that hold an argument.",
    color: "#B3374A",
    topics: ["Grammar", "Comprehension", "Summary Writing", "Oral English", "Vocabulary Development", "Stress Patterns", "Other"],
  },
  {
    slug: "vocational-development",
    name: "Vocational Development",
    tagline: "Practical skills for work and creative life",
    description: "Hands-on skills you can use straight away: music, photography, graphics, video editing, proposal writing and managing your money.",
    color: "#9C2F6E",
    topics: ["Music", "Photography", "Graphics", "Video Editing", "Proposal Writing", "Financial Intelligence", "Other"],
  },
  {
    slug: "test-preparation",
    name: "Test Preparation",
    tagline: "Get ready for the exam that's next",
    description: "Focused preparation for international and Nigerian exams, from SAT, GRE and IELTS to WAEC, NECO, UTME and Common Entrance.",
    color: "#A84F12",
    topics: [
      "SAT",
      "ACT",
      "GRE",
      "GMAT",
      "LSAT",
      "MCAT",
      "TOEFL",
      "IELTS",
      "BECE (Nigeria)",
      "WAEC (West Africa)",
      "NECO (Nigeria)",
      "Common Entrance (Nigeria)",
      "UTME (Nigeria)",
      "JUPEB (Nigeria)",
      "IJMB (Nigeria)",
      "Other",
    ],
  },
];
