import type { SeedCourse } from "./types";

export const grammar: SeedCourse = {
  key: "grammar",
  subject: "english",
  teacher: "grace",
  title: "Grammar that holds up",
  summary: "Sentences, commas and the homophones everyone mixes up, fixed for good.",
  description: `Good grammar isn't about rules for their own sake. It's what makes your writing easy to read and hard to misunderstand.

In this course you'll learn what makes a sentence complete, where commas actually belong, and how to stop mixing up *there*, *their* and *they're*. Each lesson is short, with examples you can copy and mistakes to watch for.

**You'll finish able to:**

- spot and fix sentence fragments and run-on sentences
- use commas in lists, after introductions and between clauses
- choose the right homophone every time`,
  level: "FOUNDATION",
  status: "PUBLISHED",
  featured: true,
  lessons: [
    {
      title: "What makes a sentence",
      minutes: 12,
      body: `A sentence needs three things:

1. **A subject**: who or what the sentence is about.
2. **A verb**: what the subject does or is.
3. **A complete thought**: it makes sense on its own.

> *The nurse checked the chart.* Subject: *the nurse*. Verb: *checked*. Complete thought: yes.

## Fragments

A fragment is missing one of the three. It often starts with a word like *because*, *although* or *when*, and never finishes the thought.

| Fragment | Fixed |
| --- | --- |
| Because the bus was late. | We walked, because the bus was late. |
| Walking to school in the rain. | I was walking to school in the rain. |

## Run-on sentences

A run-on joins two complete sentences with nothing between them.

- Run-on: *I was tired I went to bed.*
- Fixed with a full stop: *I was tired. I went to bed.*
- Fixed with a joining word: *I was tired, so I went to bed.*

**Try it:** find the last paragraph you wrote. Read each sentence on its own. Does it make sense by itself?`,
    },
    {
      title: "Commas that earn their place",
      minutes: 15,
      body: `Commas tell the reader where to pause. Use them for a reason, not by feel.

## 1. Between items in a list

*We need bandages, gloves and saline.*

## 2. After an introduction

When a sentence opens with a phrase or clause that sets the scene, put a comma after it.

- *After lunch, we went back to class.*
- *If the pain gets worse, call the ward.*

## 3. Before a joining word between two sentences

When *and, but, or, so, yet* joins two complete sentences, put a comma before it.

*The test was hard, but everyone finished it.*

## 4. Around extra information

If you could remove a phrase and the sentence still works, wrap it in commas.

*My sister, who lives in Lagos, is a midwife.*

## The comma splice

The most common comma mistake is joining two complete sentences with only a comma:

- Wrong: *I was tired, I went to bed.*
- Right: *I was tired, so I went to bed.* or *I was tired; I went to bed.*`,
    },
    {
      title: "There, their, they're and friends",
      minutes: 10,
      body: `These words sound the same but mean different things. Spellcheck won't catch them, so you have to.

| Word | Meaning | Test |
| --- | --- | --- |
| **there** | a place, or "there is" | Can you swap in *here*? |
| **their** | belongs to them | Can you swap in *our*? |
| **they're** | they are | Can you swap in *they are*? |

*They're leaving their bags over there.*

## The other usual suspects

- **its** (belongs to it) and **it's** (it is): *It's wagging its tail.*
- **your** (belongs to you) and **you're** (you are): *You're forgetting your keys.*
- **to** (direction), **too** (also, or excess) and **two** (2): *Two of us went to the shop too.*

**Rule of thumb:** an apostrophe in these words almost always means letters are missing. *It's* = *it is*, *they're* = *they are*.`,
    },
  ],
  assessments: [
    {
      kind: "QUIZ",
      title: "Grammar check",
      instructions: "Five questions on sentences, commas and homophones. You need 60% to pass, and you can retake it as often as you like.",
      passPercent: 60,
      questions: [
        {
          prompt: "Which of these is a complete sentence?",
          options: ["Because the bus was late.", "The bus was late, so we walked.", "Walking to school in the rain.", "Although it rained all day."],
          correct: 1,
          explanation: "It has a subject, a verb and a complete thought. The others leave the thought unfinished.",
        },
        {
          prompt: "Choose the right word: \"___ going to be late.\"",
          options: ["Their", "There", "They're"],
          correct: 2,
          explanation: "Swap in \"they are\": \"They are going to be late.\"",
        },
        {
          prompt: "Which sentence uses the comma correctly?",
          options: ["After lunch, we went back to class.", "After lunch we went, back to class.", "After, lunch we went back to class."],
          correct: 0,
          explanation: "The comma goes after the introductory phrase.",
        },
        {
          prompt: "Choose the right word: \"The dog wagged ___ tail.\"",
          options: ["it's", "its"],
          correct: 1,
          explanation: "The tail belongs to the dog, so no apostrophe. \"It's\" means \"it is\".",
        },
        {
          prompt: "Which of these is a comma splice?",
          options: ["I was tired, I went to bed.", "I was tired, so I went to bed.", "I was tired; I went to bed."],
          correct: 0,
          explanation: "Two complete sentences joined only by a comma.",
        },
      ],
    },
    {
      kind: "ASSIGNMENT",
      title: "Fix the paragraph",
      instructions: `Rewrite this paragraph so every sentence is correct. Then add one or two lines explaining the changes you made.

> their going to the clinic on monday, the doctor said its important. Because the results came back. They need to bring there forms, they also need ID.`,
      passPercent: 50,
      maxPoints: 20,
      dueInDays: 5,
    },
  ],
};

export const persuasiveEssay: SeedCourse = {
  key: "essay",
  subject: "english",
  teacher: "grace",
  title: "Writing a persuasive essay",
  summary: "Plan, argue and structure an essay that changes someone's mind.",
  description: `A persuasive essay has one job: to convince the reader. This course walks through choosing a clear position, backing it with evidence, and answering the other side before they can.

You'll plan an essay with a simple five-paragraph structure, then learn how to make each paragraph pull its weight.`,
  level: "INTERMEDIATE",
  status: "IN_REVIEW",
  lessons: [
    {
      title: "Taking a clear position",
      minutes: 12,
      body: `Your thesis is one sentence that says what you think and why.

- Weak: *School uniforms have pros and cons.*
- Strong: *School uniforms should stay, because they reduce cost pressure on families and keep the focus on learning.*

A strong thesis is **specific**, **arguable** and **short enough to remember**.`,
    },
    {
      title: "Building the body paragraphs",
      minutes: 15,
      body: `Each body paragraph makes one point. Use **PEEL**:

1. **Point**: the claim.
2. **Evidence**: a fact, example or quote.
3. **Explain**: why the evidence supports the point.
4. **Link**: connect back to your thesis.`,
    },
  ],
  assessments: [],
};
