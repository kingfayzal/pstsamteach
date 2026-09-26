# Design plan

Written with the `frontend-design` skill: plan, check the plan against the
brief, then build.

## Subject, audience, job

- **Subject:** a teaching platform for English, Mathematics and Nursing, where
  real teachers publish courses and mark students' work.
- **Audience:** adult and older-teen learners (a lot of them exam or licensing
  prep), the teachers who write for them, and the owners who run the platform.
- **Primary job:** get from "I want to learn this" to "my work has been marked"
  with as little friction as possible.

The one ritual all three subjects share is **marking**: a teacher's pen on a
student's page. That is where the visual identity comes from: the school
exercise book, its ruled paper, and the marking pen.

## Tokens

| Name | Hex | Role |
| --- | --- | --- |
| Paper | `#F5F8FC` | Page background, a cool exercise-book white (deliberately not cream) |
| Ink | `#15213F` | Text and primary buttons: navy-black fountain-pen ink, not grey-black |
| Rule | `#C8D5EA` | Ruled-line blue for borders and dividers |
| Margin | `#E79AA6` | The pink margin line, used only on "sheet" surfaces |
| Tick | `#1D8F55` | Marking-pen green for completion, passing grades and ticks |
| English | `#B3374A` | Exercise-book cover red |
| Mathematics | `#2356C2` | Exercise-book cover blue |
| Nursing | `#0A7684` | Scrubs teal |

Subject colours carry information (which subject this is), never decoration.

## Type

- **Atkinson Hyperlegible Next** for everything: UI, body and headings. It
  was designed by the Braille Institute so that 1/l/I and 0/O can't be mistaken
  for each other. That matters when a nursing student reads "0.5 mg" or a maths
  student reads "x = 1". Headings use weight 800 with tight tracking, so the
  type itself does the work.
- **Kalam** for the teacher's handwriting only: feedback notes, hero margin
  comments and circled scores. It is never used for UI chrome.
- **Scale** (classical, from *The Elements of Typographic Style*): 14 / 16 / 18
  / 21 / 24 / 36 / 48 / 72. Body is 17px on 1.6 leading, and line length is
  capped at about 70ch.

## Layout

The landing hero pairs a left-aligned headline with a marked worksheet:

```
+---------------------------------------------------------------+
| SamTeach                        Courses  Teach  Log in [Join] |
|                                                               |
| Learn it.                    .-----------------------------.  |
| Practise it.                 | |  1. 3x + 5 = 20   x = 5  ✓ |  |
| Get it marked.               | |  2. Their going... they're |  |
|                              | |  3. 250 mg → 10 mL       ✓ |  |
| one-line explainer           | |          (2/3) check homo. |  |
| [Create a student account]   '-----------------------------'  |
| Apply to teach                                                |
+---------------------------------------------------------------+
|  [English book] [Maths book] [Nursing book]   subject covers  |
+---------------------------------------------------------------+
```

- **App shells** (learn / teach / admin): a left rail with the role's nav, and
  content on paper, separated by rule-blue hairlines. Lists and tables rather
  than card grids. On mobile the rail becomes a top bar with a disclosure menu.
- **Catalog:** subject filters look like notebook divider tabs, and courses sit
  on a shelf of exercise-book covers (subject colour, white label panel with
  the title written in it).
- **Alignment:** left-aligned throughout. Nothing is centred except empty states.

## Principles

1. **Marking is the signature.** Ticks, circled scores and handwritten
   feedback appear only where real marking happens: grades, results and the
   hero. That is the one bold element; everything else stays quiet.
2. **Ink on paper.** Hairline rules, almost no shadows. Only the lifted
   worksheet and the book covers get depth.
3. **Colour is information.** The subject colour tells you which subject you're
   in, and green means done or passed.
4. **Legibility first.** 17px body, strong contrast, visible focus, and
   reduced motion respected.
5. **One orchestrated moment.** The hero's pen marks draw in once on load.
   No scroll-triggered fade-ins or hover wobbles.

## Review against the brief (pass 2)

A generic "education platform" prompt lands on an indigo/violet gradient hero,
Inter, rounded-2xl feature cards with soft shadows, and a big-number stats row.
This plan checked itself against that default and against the known AI tells:

- **Background:** cool paper `#F5F8FC`, not cream `#F4F1EA`. Accent is marking
  green, not terracotta. No near-black-plus-acid scheme.
- **Cards:** revised away from a feature-card grid for "why us". That section
  is now the three subject covers, which are real navigation. Admin numbers are
  a plain table row, not big-number tiles with gradients.
- **Labels:** no ALL-CAPS eyebrow labels, no `A · B · C` meta strings, no `→`
  on buttons, no monospace data labels. Meta text uses commas or separate
  lines.
- **Numbering:** the 1/2/3 in the hero worksheet is kept because those are
  literally question numbers on a sheet. It is a real sequence.
- **Radius:** varies by hierarchy instead of one radius everywhere. Book covers
  get a 3px corner plus a spine, controls 6px, and panels are square with
  hairline rules.

## Copy voice

Plain, direct, sentence case. Buttons say exactly what happens ("Enrol in
course", "Submit for review", "Save lesson"), and the success notice repeats
the verb ("Enrolled", "Submitted for review"). Errors explain how to fix
things and never apologise. Empty states tell you what to do next.

---

# Phase 2: choosing a teacher

The directory has one job: help a student decide who they'd like to learn
with. Preply-style discovery, in the same exercise-book language.

- **Directory rows, not cards.** Each teacher is a ruled row (photo, name and
  headline, subject-coloured topic tags, languages, a short excerpt, the next
  free time), with rating, student count and actions in a right-hand column.
  This keeps to the "lists rather than card grids" rule, and it scans like a
  staff list.
- **Photo or monogram.** Real photos when teachers upload them. Otherwise
  initials on the teacher's own subject colour, so the colour still says what
  they teach.
- **The timetable is the profile's memorable element.** A school timetable
  grid: days across, times of day down, ink-filled cells where the teacher
  usually teaches, always converted to the viewer's time zone. It comes from
  the subject's own vernacular and answers the one question every student
  has ("can I actually make their times?").
- **Filters in one row above the list** (subject, topic, language, day, time
  of day, sort, search), as plain GET controls, so every filtered view has a
  shareable URL.
- **Ratings stay plain.** A single ink star with a number. Reviews show five
  small stars, then the student's first name and initial. Handwriting remains
  reserved for a teacher's marking.
- **Slot picker:** columns of days with time chips, scrolling sideways on
  phones inside a positioned container, so screen-reader-only inputs can't
  widen the page.
- **Copy:** "Choose Ruth as your teacher", "Send request to Ruth", "Accept
  Kemi", "Book this session". Actions keep their verb through the confirmation
  notices.
