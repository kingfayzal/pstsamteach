/**
 * Demo teacher profiles and topics. Fictional people for local development
 * only; the seed refuses to run against a remote database.
 */

export const TOPICS: Record<"english" | "mathematics" | "nursing", string[]> = {
  english: ["Grammar and punctuation", "Essay writing", "Reading comprehension", "Spoken English", "IELTS preparation", "Business English"],
  mathematics: ["Arithmetic", "Algebra", "Geometry", "Statistics", "Calculus", "Exam preparation"],
  nursing: [
    "Dosage calculations",
    "Pharmacology",
    "Anatomy and physiology",
    "Fundamentals of nursing",
    "Licensing exam preparation",
    "Maternal and child health",
  ],
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
    topics: [{ subject: "english", names: ["Grammar and punctuation", "Essay writing", "IELTS preparation"] }],
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
    topics: [{ subject: "mathematics", names: ["Algebra", "Geometry", "Exam preparation"] }],
    timeZone: "Africa/Lagos",
    sessionMinutes: 60,
    acceptingStudents: true,
    windows: days([1, 2, 3, 4, 5], h(16), h(19)),
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
    topics: [{ subject: "english", names: ["Spoken English", "Business English", "Reading comprehension"] }],
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
    topics: [{ subject: "mathematics", names: ["Statistics", "Calculus", "Arithmetic"] }],
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
    topics: [{ subject: "mathematics", names: ["Arithmetic", "Algebra"] }],
    timeZone: "Africa/Lagos",
    sessionMinutes: 60,
    acceptingStudents: false,
    windows: days([6, 0], h(9), h(12)),
  },
];
