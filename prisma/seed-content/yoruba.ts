import type { SeedCourse } from "./types";

export const yorubaBasics: SeedCourse = {
  key: "yoruba",
  subject: "yoruba",
  teacher: "bisi",
  title: "Speak Yoruba: first conversations",
  summary: "Greet people properly, hear the three tones, and introduce yourself in Yoruba.",
  description: `Yoruba is spoken by tens of millions of people in south-west Nigeria, Benin and Togo, and by Yoruba families all over the world. This course is for complete beginners of any age, including people who understand a little from home but have never spoken it back.

You'll learn how a greeting shows respect, how the three tones change what a word means, and enough everyday Yoruba to introduce yourself.

**You'll finish able to:**

- greet people at any time of day, politely
- hear and say the high, mid and low tones
- introduce yourself and ask someone how they are`,
  level: "FOUNDATION",
  status: "PUBLISHED",
  featured: true,
  lessons: [
    {
      title: "Greetings and respect",
      minutes: 12,
      body: `In Yoruba, how you greet someone depends on the time of day and on who you're greeting.

To an elder, someone you don't know well, or a group, start with **Ẹ**. It's the respectful form. To a friend or someone younger, leave it out, or use **O**.

| Time | To an elder or a group | To a friend or someone younger |
| --- | --- | --- |
| Morning | Ẹ káàárọ̀ | Káàárọ̀ |
| Afternoon | Ẹ kú ọ̀sán | O kú ọ̀sán |
| Evening | Ẹ kú ìrọ̀lẹ́ | O kú ìrọ̀lẹ́ |

At night, say **Ó dàárọ̀** (good night; literally, "until morning").

## Words you'll use every day

- **Báwo ni?** How are you?
- **Dáadáa ni.** I'm fine.
- **Ẹ ṣeun.** Thank you (respectful). To a friend: **O ṣeun.**
- **Ẹ jọ̀ọ́.** Please (respectful). To a friend: **Jọ̀ọ́.**

Traditionally, young men prostrate and young women kneel to greet elders. You'll still see it at family gatherings, in Nigeria and abroad.`,
    },
    {
      title: "The three tones",
      minutes: 15,
      body: `Yoruba is a **tonal** language: the pitch of your voice is part of the word. There are three tones, and the marks above the vowels tell you which one to use.

| Tone | Mark | Example |
| --- | --- | --- |
| High | acute accent | á |
| Mid | no mark | a |
| Low | grave accent | à |

## Why it matters

These three words have the same letters. Only the tone on the last syllable changes:

- **ọkọ** (mid, mid): husband
- **ọkọ̀** (mid, low): vehicle
- **ọkọ́** (mid, high): hoe

Say each one out loud, slowly. Then say them one after another and listen for the last syllable moving.

## Letters with a dot

The Yoruba alphabet has 25 letters. Three of them carry a dot underneath:

- **ẹ** sounds like the *e* in "bed"
- **ọ** sounds like the *o* in "pot"
- **ṣ** sounds like *sh* in "shop"

**gb** is a single sound, made with *g* and *b* at the same time. There is no c, q, v, x or z.`,
    },
    {
      title: "Introduce yourself",
      minutes: 12,
      body: `## Asking and giving your name

- **Kí ni orúkọ rẹ?** What is your name? (to a friend)
- **Kí ni orúkọ yín?** What is your name? (respectful)
- **Orúkọ mi ni Adé.** My name is Adé.
- **Mo wá láti Èkó.** I come from Lagos.
- **Ó dàbọ̀.** Goodbye.

## A first conversation

Read it aloud, then try it with your teacher, swapping in your own name and city.

| Who | What they say |
| --- | --- |
| **Adé** | Káàárọ̀! Báwo ni? |
| **Bọ́lá** | Dáadáa ni. Kí ni orúkọ rẹ? |
| **Adé** | Orúkọ mi ni Adé. Ìwọ ńkọ́? |
| **Bọ́lá** | Orúkọ mi ni Bọ́lá. |
| **Adé** | Ó dàbọ̀! |

**Ìwọ ńkọ́?** means "And you?" It's the easiest way to keep a conversation going.`,
    },
  ],
  assessments: [
    {
      kind: "QUIZ",
      title: "Greetings and tones",
      instructions: "Five questions. Say each answer out loud before you choose it. You need 60% to pass.",
      passPercent: 60,
      questions: [
        {
          prompt: "How do you greet an elder in the morning?",
          options: ["Ẹ káàárọ̀", "O kú ìrọ̀lẹ́", "Ó dàbọ̀", "Ẹ ṣeun"],
          correct: 0,
          explanation: "Káàárọ̀ is the morning greeting, and Ẹ makes it respectful.",
        },
        { prompt: "What does \"Ẹ ṣeun\" mean?", options: ["Please", "Thank you", "Goodbye", "Good night"], correct: 1 },
        {
          prompt: "Which mark shows a high tone?",
          options: ["A grave accent, as in à", "An acute accent, as in á", "No mark, as in a", "A dot underneath, as in ọ"],
          correct: 1,
          explanation: "High is the acute accent, low is the grave accent, and mid has no mark.",
        },
        {
          prompt: "What does ọkọ̀ (low tone on the last syllable) mean?",
          options: ["Husband", "Hoe", "Vehicle", "Name"],
          correct: 2,
          explanation: "ọkọ is husband, ọkọ̀ is vehicle and ọkọ́ is hoe.",
        },
        {
          prompt: "How do you say \"My name is Adé\"?",
          options: ["Orúkọ mi ni Adé.", "Kí ni orúkọ rẹ?", "Mo wá láti Adé.", "Báwo ni Adé?"],
          correct: 0,
        },
      ],
    },
    {
      kind: "ASSIGNMENT",
      title: "Introduce yourself in writing",
      instructions:
        "Write four to six lines in Yoruba: greet the reader for the time of day, give your name, say where you come from, and say goodbye. Add tone marks where you can. Your teacher will correct them and mark the rest.",
      passPercent: 60,
      maxPoints: 10,
      dueInDays: 7,
    },
  ],
};
