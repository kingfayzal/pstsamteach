/**
 * Demo teacher profiles and topics. Fictional people for local development
 * only; the seed refuses to run against a remote database.
 */

import { CATALOG } from "./catalog";

const catalogTopics = (slug: string): string[] => [...(CATALOG.find((subject) => subject.slug === slug)?.topics ?? [])];

/** Topics per subject slug. The platform's own subjects come from the catalog, as on every real database. */
export const TOPICS: Record<"english" | "mathematics" | "vocational-development" | "test-preparation" | "nursing" | "yoruba" | "music", string[]> = {
  english: catalogTopics("english"),
  mathematics: catalogTopics("mathematics"),
  "vocational-development": catalogTopics("vocational-development"),
  "test-preparation": catalogTopics("test-preparation"),
  nursing: [
    "Dosage calculations",
    "Pharmacology",
    "Anatomy and physiology",
    "Fundamentals of nursing",
    "Licensing exam preparation",
    "Maternal and child health",
  ],
  yoruba: ["Greetings and conversation", "Tones and pronunciation", "Reading and writing", "Yoruba for children", "Proverbs and culture"],
  music: ["Bass guitar", "Rhythm and timing", "Reading tab and notation", "Music theory"],
};

type Window = { weekday: number; startMinute: number; endMinute: number };
const h = (hour: number, minute = 0) => hour * 60 + minute;
const days = (weekdays: number[], start: number, end: number): Window[] => weekdays.map((weekday) => ({ weekday, startMinute: start, endMinute: end }));

export type TeacherSeed = {
  key: string;
  name: string;
  email: string;
  isExisting: boolean;
  headline: string;
  about: string;
  teachingStyle: string;
  qualifications: string;
  experienceYears: number;
  languages: string[];
  topics: { subject: keyof typeof TOPICS; names: string[] }[];
  timeZone: string;
  sessionMinutes: number;
  acceptingStudents: boolean;
  windows: Window[];
};

export const TEACHERS: TeacherSeed[] = [
  {
    key: "ruth",
    name: "Ruth Mensah",
    email: "ruth@example.com",
    isExisting: true,
    headline: "Nurse educator who makes dosage calculations click",
    about:
      "I trained as a nurse and have spent the last eleven years teaching student nurses, mostly the parts of the course people dread: drug calculations and pharmacology.\n\nIf numbers make you nervous, you're exactly who I like teaching. We go slowly, we check everything twice, and by the end you'll check your own work without thinking about it.",
    teachingStyle:
      "Every session starts with a question you got wrong recently. We work through it together, then do three more like it until the method is automatic. You'll always leave with a short set of practice questions.",
    qualifications: "Registered nurse\nPostgraduate certificate in clinical education",
    experienceYears: 11,
    languages: ["English", "Twi"],
    topics: [{ subject: "nursing", names: ["Dosage calculations", "Pharmacology", "Licensing exam preparation"] }],
    timeZone: "Africa/Accra",
    sessionMinutes: 60,
    acceptingStudents: true,
    windows: [...days([1, 3, 5], h(17), h(21)), ...days([6], h(9), h(13))],
  },
  {
    key: "grace",
    name: "Grace Adeyemi",
    email: "grace@example.com",
    isExisting: true,
    headline: "Clear writing for exams, work and everything in between",
    about:
      "I've taught English for twelve years, mostly exam classes, and I now coach adults who need to write well at work or pass IELTS.\n\nI care about writing that's easy to read. We'll fix the grammar that trips you up, then work on structure so your essays and emails say exactly what you mean.",
    teachingStyle: "You send me a short piece of writing before each session. We mark it together, line by line, and rewrite the weakest paragraph.",
    qualifications: "BA English and Education\nIELTS examiner training",
    experienceYears: 12,
    languages: ["English", "Yoruba"],
    topics: [
      { subject: "english", names: ["Grammar", "Summary Writing", "Comprehension"] },
      { subject: "test-preparation", names: ["IELTS", "WAEC (West Africa)"] },
    ],
    timeZone: "Africa/Lagos",
    sessionMinutes: 60,
    acceptingStudents: true,
    windows: [...days([2, 4], h(18), h(21)), ...days([6], h(10), h(14))],
  },
  {
    key: "daniel",
    name: "Daniel Okafor",
    email: "daniel@example.com",
    isExisting: true,
    headline: "Maths without the fear, one step at a time",
    about:
      "Secondary maths teacher and tutor for eight years. Most of my students arrive convinced they're \"not a maths person\". Most leave able to solve problems they'd have skipped before.\n\nI show every step, because the steps are the maths. Algebra, geometry and exam technique are my favourites.",
    teachingStyle: "Short explanations, lots of practice, and I ask you to explain your answer back to me. If you can teach it, you know it.",
    qualifications: "BSc Mathematics\nPGDE (secondary maths)",
    experienceYears: 8,
    languages: ["English", "Igbo"],
    topics: [
      { subject: "mathematics", names: ["Algebra I & II", "Geometry", "Trigonometry"] },
      { subject: "test-preparation", names: ["WAEC (West Africa)", "UTME (Nigeria)"] },
    ],
    timeZone: "Africa/Lagos",
    sessionMinutes: 60,
    acceptingStudents: true,
    windows: days([1, 2, 3, 4, 5], h(16), h(19)),
  },
  {
    key: "bisi",
    name: "Bisi Adewale",
    email: "bisi@example.com",
    isExisting: true,
    headline: "Native Yoruba speaker teaching children and adults to speak it with confidence",
    about:
      "I grew up in Ibadan speaking Yoruba at home and English at school, and I've taught Yoruba for nine years, first in Nigeria and now online to families in the US and the UK.\n\nMany of my students understand some Yoruba from their parents but freeze when they try to speak it. We fix that with real conversation from the first lesson, and we learn to read and write it properly, tone marks included.",
    teachingStyle:
      "Lessons are mostly spoken. We practise greetings and everyday phrases out loud, listen for the tones, then write a few lines together. Children learn through songs, stories and games.",
    qualifications: "BA Yoruba Language and Literature\nPGDE (languages)",
    experienceYears: 9,
    languages: ["Yoruba", "English"],
    topics: [{ subject: "yoruba", names: ["Greetings and conversation", "Tones and pronunciation", "Reading and writing", "Yoruba for children"] }],
    timeZone: "America/New_York",
    sessionMinutes: 60,
    acceptingStudents: true,
    windows: [...days([1, 3, 4], h(17), h(20)), ...days([6], h(9), h(13))],
  },
  {
    key: "femi",
    name: "Femi Adeola",
    email: "femi@example.com",
    isExisting: true,
    headline: "Bass guitar from your first note to your first band",
    about:
      "I've played bass in church bands, wedding bands and recording sessions for fourteen years, and taught teenagers and adults for the last six.\n\nYou don't need to read music to start. We begin with tab and your ears, and you'll play a real groove in your first lesson. Students aged 13 and above are welcome.",
    teachingStyle:
      "A short warm-up, one new technique, then we play along to a real song together. You'll leave each lesson with a practice plan for the week and a backing track to play over.",
    qualifications: "Diploma in Music Performance\nProfessional session and live bassist",
    experienceYears: 6,
    languages: ["English", "Yoruba"],
    topics: [{ subject: "music", names: ["Bass guitar", "Rhythm and timing", "Reading tab and notation"] }],
    timeZone: "America/New_York",
    sessionMinutes: 60,
    acceptingStudents: true,
    windows: [...days([2, 4], h(18), h(21)), ...days([0], h(14), h(18))],
  },
  {
    key: "blessing",
    name: "Blessing Okoro",
    email: "blessing@example.com",
    isExisting: false,
    headline: "Confident spoken English for interviews and the workplace",
    about:
      "I help adults speak English with confidence: in interviews, in meetings and on the phone. Before teaching I worked in customer service for a telecoms company, so I know the situations you'll face.\n\nSessions are mostly conversation, with gentle corrections and the phrases you actually need.",
    teachingStyle: "We pick a real situation you're preparing for, role-play it, then polish the language together.",
    qualifications: "BA Linguistics\nCELTA",
    experienceYears: 6,
    languages: ["English", "Igbo", "Nigerian Pidgin"],
    topics: [{ subject: "english", names: ["Oral English", "Vocabulary Development", "Comprehension"] }],
    timeZone: "Africa/Lagos",
    sessionMinutes: 45,
    acceptingStudents: true,
    windows: [...days([1, 2, 3, 4, 5], h(7), h(10)), ...days([0], h(15), h(19))],
  },
  {
    key: "kwame",
    name: "Kwame Asante",
    email: "kwame@example.com",
    isExisting: false,
    headline: "Statistics and calculus for university students",
    about:
      "Fifteen years teaching university-level maths. I specialise in statistics and calculus for students whose degree needs them but who didn't choose maths.\n\nI'm patient, I like a good real-world example, and I'll never make you feel slow for asking.",
    teachingStyle: "Longer sessions so we can work through full problems from your own course, start to finish.",
    qualifications: "MSc Applied Statistics",
    experienceYears: 15,
    languages: ["English", "Twi", "French"],
    topics: [{ subject: "mathematics", names: ["Statistics", "Calculus", "Basic Math"] }],
    timeZone: "Africa/Accra",
    sessionMinutes: 90,
    acceptingStudents: true,
    windows: [...days([2, 4], h(19), h(22)), ...days([0], h(14), h(18))],
  },
  {
    key: "amaka",
    name: "Amaka Nwosu",
    email: "amaka@example.com",
    isExisting: false,
    headline: "Nursing fundamentals from a UK ward sister",
    about:
      "I'm a ward sister in the UK and I teach nursing students in the evenings. I focus on the foundations: anatomy and physiology, fundamentals of care, and maternal and child health.\n\nI'll connect the theory to what you'll actually see on placement, so it sticks.",
    teachingStyle: "Case-based: we take a patient scenario and work out what's happening in the body and what care they need.",
    qualifications: "Registered nurse (adult)\nMSc Advanced Nursing Practice",
    experienceYears: 9,
    languages: ["English", "Igbo"],
    topics: [{ subject: "nursing", names: ["Anatomy and physiology", "Fundamentals of nursing", "Maternal and child health"] }],
    timeZone: "Europe/London",
    sessionMinutes: 60,
    acceptingStudents: true,
    windows: days([1, 2, 3, 4], h(19), h(22)),
  },
  {
    key: "yusuf",
    name: "Yusuf Abdullahi",
    email: "yusuf@example.com",
    isExisting: false,
    headline: "Rebuilding number confidence from the basics",
    about:
      "I teach arithmetic and early algebra to adults going back to education. Fractions, percentages and equations stop being scary once you see why they work.\n\nMy weekends are full at the moment, but save my profile and I'll open space again soon.",
    teachingStyle: "Lots of everyday examples: shopping, cooking, travel. We build from what you already know.",
    qualifications: "BSc Mathematics Education",
    experienceYears: 4,
    languages: ["English", "Hausa", "Arabic"],
    topics: [{ subject: "mathematics", names: ["Basic Math", "Algebra I & II"] }],
    timeZone: "Africa/Lagos",
    sessionMinutes: 60,
    acceptingStudents: false,
    windows: days([6, 0], h(9), h(12)),
  },
];
