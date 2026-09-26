/** Languages a teacher can say they teach in. Extend as the platform grows. */
export const LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "Portuguese",
  "Arabic",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Nigerian Pidgin",
  "Twi",
  "Swahili",
  "Amharic",
  "Hindi",
  "Urdu",
  "Mandarin",
  "Tagalog",
] as const;

export type Language = (typeof LANGUAGES)[number];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}
