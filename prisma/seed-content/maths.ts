import type { SeedCourse } from "./types";

export const algebra: SeedCourse = {
  key: "algebra",
  subject: "mathematics",
  teacher: "daniel",
  title: "Algebra from the ground up",
  summary: "Letters stand for numbers. Learn to use them and solve linear equations with confidence.",
  description: `Algebra looks strange at first, but it's arithmetic with a placeholder. This course starts with what a variable is and ends with you turning word problems into equations and solving them.

Every step is shown. When you get stuck, go back one lesson. The idea you're missing is usually there.

**You'll finish able to:**

- simplify expressions by collecting like terms
- solve one- and two-step linear equations
- turn a sentence into an equation and solve it`,
  level: "FOUNDATION",
  status: "PUBLISHED",
  featured: true,
  lessons: [
    {
      title: "Variables and expressions",
      minutes: 12,
      body: `A **variable** is a letter that stands for a number we don't know yet, or a number that can change.

In *3x + 2*, the letter **x** is the variable. *3x* means 3 × x.

## Substituting

If x = 4, then 3x + 2 = 3 × 4 + 2 = **14**.

## Collecting like terms

**Like terms** have the same letter. You can add or subtract them.

- 4a + 3a = **7a**
- 4a + 3b − a + 2b = **3a + 5b** (the a's together, the b's together)
- You **can't** combine 3a and 5b. They're different letters.`,
    },
    {
      title: "Solving linear equations",
      minutes: 18,
      body: `An equation is a balance. Whatever you do to one side, do to the other.

## One step

x + 7 = 12. Subtract 7 from both sides: **x = 5**.

3x = 21. Divide both sides by 3: **x = 7**.

## Two steps

Solve 3x + 5 = 20.

1. Subtract 5 from both sides: 3x = 15
2. Divide both sides by 3: **x = 5**

**Check it:** 3 × 5 + 5 = 20. ✓

Undo the operations in reverse order: deal with adding and subtracting first, then multiplying and dividing.`,
    },
    {
      title: "From words to equations",
      minutes: 15,
      body: `Word problems are equations in disguise. Name the unknown, then translate each phrase.

| Words | Maths |
| --- | --- |
| a number | n |
| doubled | 2n |
| plus 4 | + 4 |
| is 18 | = 18 |

*A number doubled, plus 4, is 18.* becomes 2n + 4 = 18.

Solve: 2n = 14, so **n = 7**. Check: 2 × 7 + 4 = 18. ✓

**Tip:** always write what your letter stands for before you start: "Let n be the number."`,
    },
  ],
  assessments: [
    {
      kind: "QUIZ",
      title: "Solving equations",
      instructions: "Five questions. Work each one out on paper first. You need 60% to pass.",
      passPercent: 60,
      questions: [
        { prompt: "Solve: x + 7 = 12", options: ["5", "19", "7", "−5"], correct: 0, explanation: "Subtract 7 from both sides." },
        { prompt: "Solve: 3x = 21", options: ["18", "7", "24", "63"], correct: 1, explanation: "Divide both sides by 3." },
        { prompt: "Solve: 3x + 5 = 20", options: ["15", "25", "5", "7"], correct: 2, explanation: "Subtract 5 to get 3x = 15, then divide by 3." },
        {
          prompt: "Simplify: 4a + 3b − a + 2b",
          options: ["5a + 5b", "3a + 5b", "3a + b", "8ab"],
          correct: 1,
          explanation: "4a − a = 3a and 3b + 2b = 5b.",
        },
        {
          prompt: "A number doubled, plus 4, is 18. What is the number?",
          options: ["7", "11", "9", "14"],
          correct: 0,
          explanation: "2n + 4 = 18, so 2n = 14 and n = 7.",
        },
      ],
    },
  ],
};

export const fractions: SeedCourse = {
  key: "fractions",
  subject: "mathematics",
  teacher: "daniel",
  title: "Fractions, decimals and percentages",
  summary: "Three ways of writing the same thing, and how to move between them.",
  description: `3/4, 0.75 and 75% are the same amount written three ways. Once you can switch between them, comparing prices, reading results and working out discounts gets much easier.`,
  level: "FOUNDATION",
  status: "PUBLISHED",
  lessons: [
    {
      title: "Converting between the three",
      minutes: 14,
      body: `- **Fraction to decimal:** divide the top by the bottom. 3 ÷ 4 = 0.75
- **Decimal to percentage:** multiply by 100. 0.75 × 100 = 75%
- **Percentage to decimal:** divide by 100. 40% = 0.4

| Fraction | Decimal | Percentage |
| --- | --- | --- |
| 1/2 | 0.5 | 50% |
| 1/4 | 0.25 | 25% |
| 3/4 | 0.75 | 75% |
| 1/5 | 0.2 | 20% |`,
    },
    {
      title: "Percentages of amounts",
      minutes: 12,
      body: `To find a percentage of an amount, turn the percentage into a decimal and multiply.

20% of 150 = 0.2 × 150 = **30**

**Shortcut:** 10% is the amount divided by 10. For 20%, double it. For 5%, halve it.`,
    },
  ],
  assessments: [
    {
      kind: "QUIZ",
      title: "Convert and compare",
      instructions: "Three quick questions. You need 60% to pass.",
      passPercent: 60,
      questions: [
        { prompt: "What is 3/4 as a decimal?", options: ["0.34", "0.75", "0.43", "7.5"], correct: 1 },
        { prompt: "What is 20% of 150?", options: ["15", "20", "30", "75"], correct: 2 },
        { prompt: "Which is largest?", options: ["0.6", "55%", "2/3", "5/9"], correct: 2, explanation: "2/3 is about 0.667." },
      ],
    },
  ],
};
