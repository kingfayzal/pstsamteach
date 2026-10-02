import type { SeedCourse } from "./types";

export const bassGuitar: SeedCourse = {
  key: "bass",
  subject: "music",
  teacher: "femi",
  title: "Bass guitar: your first grooves",
  summary: "Hold the bass, tune it, read tab and play your first groove in time.",
  description: `The bass connects the rhythm to the harmony. It's the part that makes people move. This course is for complete beginners aged 13 and above, and you don't need to read music: we start with tab.

Practise little and often. Ten minutes a day beats an hour on Sunday.

**You'll finish able to:**

- name the four strings and tune them
- read bass tab
- play a root-note groove along with a drum beat`,
  level: "FOUNDATION",
  status: "PUBLISHED",
  lessons: [
    {
      title: "Meet your bass",
      minutes: 10,
      body: `A standard bass has **four strings**. From the thickest to the thinnest they're tuned **E, A, D, G**. One way to remember it: **E**lephants **A**nd **D**onkeys **G**row.

## Holding it

- Sit up straight with the bass resting on your leg and the neck angled slightly up.
- **Plucking hand:** rest your thumb on the pickup and pluck with your index and middle fingers, taking turns.
- **Fretting hand:** keep your thumb behind the neck and press the string just behind the fret, not on top of it.

## Tuning

Use a clip-on tuner or a tuning app. Play each open string and turn its tuning peg until the tuner shows the right note. Tune up to the note: if you go past it, drop below and come back up. Strings hold their tuning better that way.`,
    },
    {
      title: "Reading tab",
      minutes: 12,
      body: `**Tab** shows you where to put your fingers. Each line is a string, and each number is a fret.

- The **bottom** line is the thickest string (E). The top line is G.
- **0** means play the string open, without pressing a fret.
- Read from left to right.

\`\`\`
G|-----------------|
D|-----------------|
A|-----------0--2--|
E|--0--3--5--------|
\`\`\`

That's: open E, E string 3rd fret (G), E string 5th fret (A), open A, then A string 2nd fret (B).

## Frets and notes

Moving up one fret raises the note by a **semitone** (a half step). At the 12th fret you're back on the same note as the open string, one octave higher.`,
    },
    {
      title: "Your first groove",
      minutes: 15,
      body: `Most bass lines start with the **root**: the note a chord is named after. Here's a four-bar groove that plays the root of each chord four times.

\`\`\`
   E             A             B             A
G|-------------|-------------|-------------|-------------|
D|-------------|-------------|-------------|-------------|
A|-------------|-0--0--0--0--|-2--2--2--2--|-0--0--0--0--|
E|-0--0--0--0--|-------------|-------------|-------------|
\`\`\`

## Playing it in time

1. Set a metronome or drum loop to **70 beats per minute**.
2. Count out loud, "1, 2, 3, 4", and play one note on every count.
3. When it feels easy, go up by 5 beats per minute.

**Tip:** let your plucking finger come to rest on the next string down after each note. It stops the open strings ringing and keeps your groove tight.`,
    },
  ],
  assessments: [
    {
      kind: "QUIZ",
      title: "Strings, tab and timing",
      instructions: "Five questions. Keep your bass nearby and check your answers on it. You need 60% to pass.",
      passPercent: 60,
      questions: [
        {
          prompt: "From thickest to thinnest, the strings on a standard four-string bass are:",
          options: ["G D A E", "E A D G", "E A D B", "A D G C"],
          correct: 1,
        },
        {
          prompt: "In bass tab, a 0 on a line means:",
          options: ["Don't play that string", "Play the string open, without pressing a fret", "Play the 10th fret", "Rest for one beat"],
          correct: 1,
        },
        {
          prompt: "In bass tab, the bottom line is:",
          options: ["The thinnest string (G)", "The thickest string (E)", "The beat count", "The A string"],
          correct: 1,
          explanation: "Tab is drawn as if you're looking down at the bass on your lap, so the thickest string is at the bottom.",
        },
        {
          prompt: "Which note is on the 3rd fret of the E string?",
          options: ["F", "G", "A", "C"],
          correct: 1,
          explanation: "E, then F (1st fret), F sharp (2nd fret), G (3rd fret).",
        },
        {
          prompt: "Moving up one fret raises the note by:",
          options: ["A semitone (half step)", "A whole tone", "An octave", "Nothing; frets only change the volume"],
          correct: 0,
        },
      ],
    },
  ],
};
