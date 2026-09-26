import type { SeedCourse } from "./types";

export const dosage: SeedCourse = {
  key: "dosage",
  subject: "nursing",
  teacher: "ruth",
  title: "Medication dosage calculations",
  summary: "Convert units, use the formula method and check every answer before it reaches a patient.",
  description: `Dosage calculations come up in every nursing exam and every shift. This course covers the conversions you need, one formula that handles most problems, and the checks that catch mistakes.

This course is for learning and exam practice. In practice, always follow your employer's policies and double-check calculations as they require.

**You'll finish able to:**

- convert between g, mg and mcg, and between L and mL
- calculate tablet and liquid doses with the formula method
- sense-check an answer before giving a medication`,
  level: "INTERMEDIATE",
  status: "PUBLISHED",
  featured: true,
  lessons: [
    {
      title: "Units and conversions",
      minutes: 14,
      body: `Most mistakes happen before the calculation even starts, when the units don't match. **Always convert to the same unit first.**

## Weight

| From | To | Do this |
| --- | --- | --- |
| g | mg | × 1000 |
| mg | mcg | × 1000 |
| mg | g | ÷ 1000 |
| mcg | mg | ÷ 1000 |

## Volume

1 L = 1000 mL

## Examples

- 0.5 g = 0.5 × 1000 = **500 mg**
- 0.25 mg = 0.25 × 1000 = **250 mcg**
- 1500 mL = **1.5 L**

**Watch out:** write a zero before a decimal point (0.5, never .5) and never after a whole number (5, never 5.0). Both habits prevent tenfold errors.`,
    },
    {
      title: "The formula method",
      minutes: 18,
      body: `One formula covers most tablet and liquid doses:

**Dose to give = (Desired ÷ Have) × Quantity**

- **Desired**: the dose ordered
- **Have**: the strength you have in stock
- **Quantity**: the amount that strength comes in (1 tablet, or a volume in mL)

## Tablets

Ordered 500 mg. Stock is 250 mg tablets.

(500 ÷ 250) × 1 tablet = **2 tablets**

## Liquids

Ordered 250 mg. Stock is 125 mg in 5 mL.

(250 ÷ 125) × 5 mL = **10 mL**

## With a conversion first

Ordered 0.5 g. Stock is 250 mg tablets.

Convert: 0.5 g = 500 mg. Then (500 ÷ 250) × 1 = **2 tablets**.`,
    },
    {
      title: "Checking your answer",
      minutes: 12,
      body: `A correct formula with a wrong input still gives a wrong dose. Before you give anything, check.

## Does it make sense?

- If the order is **more** than the stock strength, you'll give **more** than one tablet or more than the stock volume.
- If you've worked out 20 tablets or 0.1 of a tablet, stop and recheck.

## The rights of medication administration

Check the right **patient**, right **drug**, right **dose**, right **route** and right **time**, then document what you gave.

## Independent double checks

For high-alert medications, have a colleague work out the dose separately, without seeing your answer, then compare.`,
    },
  ],
  assessments: [
    {
      kind: "QUIZ",
      title: "Dosage practice",
      instructions: "Five calculations. Show your working on paper. You need 80% to pass, because accuracy matters here.",
      passPercent: 80,
      questions: [
        { prompt: "How many milligrams are in 0.5 g?", options: ["50 mg", "500 mg", "5 mg", "5000 mg"], correct: 1, explanation: "0.5 × 1000 = 500 mg." },
        { prompt: "How many micrograms are in 0.25 mg?", options: ["25 mcg", "2.5 mcg", "250 mcg", "2500 mcg"], correct: 2, explanation: "0.25 × 1000 = 250 mcg." },
        {
          prompt: "Ordered: 500 mg. Stock: 250 mg tablets. How many tablets do you give?",
          options: ["0.5", "1", "2", "4"],
          correct: 2,
          explanation: "(500 ÷ 250) × 1 = 2 tablets.",
        },
        {
          prompt: "Ordered: 300 mg. Stock: 150 mg in 5 mL. What volume do you give?",
          options: ["5 mL", "10 mL", "15 mL", "2 mL"],
          correct: 1,
          explanation: "(300 ÷ 150) × 5 mL = 10 mL.",
        },
        {
          prompt: "Ordered: 75 mg. Stock: 50 mg in 2 mL. What volume do you give?",
          options: ["1.5 mL", "2 mL", "3 mL", "4 mL"],
          correct: 2,
          explanation: "(75 ÷ 50) × 2 mL = 3 mL.",
        },
      ],
    },
    {
      kind: "ASSIGNMENT",
      title: "Talk through a calculation",
      instructions: `A patient is prescribed 0.75 g of a medication. Stock is 250 mg tablets.

Work out how many tablets to give, showing each step, then explain how you would check your answer before giving it.`,
      passPercent: 60,
      maxPoints: 10,
      dueInDays: 3,
    },
  ],
};

export const infection: SeedCourse = {
  key: "infection",
  subject: "nursing",
  teacher: "ruth",
  title: "Infection prevention basics",
  summary: "Hand hygiene, PPE and the chain of infection.",
  description: "Draft.",
  level: "FOUNDATION",
  status: "DRAFT",
  lessons: [
    {
      title: "The chain of infection",
      minutes: 10,
      body: "Infection spreads when every link is present: agent, reservoir, way out, way of spread, way in, and a susceptible host. Break any link and you stop it.",
    },
  ],
  assessments: [],
};
