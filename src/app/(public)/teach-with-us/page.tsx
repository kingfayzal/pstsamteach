import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Teach with us",
  description: `Apply to teach with ${SITE.name}. Write lessons, set work, and mark it.`,
};

const STEPS = [
  { title: "Apply", body: "Tell us which subject you teach and about your experience. Our team reads every application." },
  { title: "Build your course", body: "Once you're approved, write lessons in plain text with optional video, then add quizzes and assignments." },
  { title: "Submit for review", body: "An admin checks the course before it goes live. If something needs changing, you'll get notes back." },
  { title: "Teach and mark", body: "Quizzes mark themselves. Written assignments land in your marking queue, where you score them and leave feedback." },
];

export default function TeachWithUsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-8">
      <div className="max-w-[44rem] space-y-5">
        <h1 className="text-5xl leading-[0.98] tracking-[-0.04em] text-ink">Teach what you know.</h1>
        <p className="text-xl text-ink-soft">
          If you teach one of our subjects, you can meet students one to one, publish a course, set work, and mark it, all in one place.
        </p>
        <LinkButton href="/apply">Apply to teach</LinkButton>
      </div>

      <ol className="mt-16 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-t-2 border-ink pt-4">
            <span className="hand text-2xl text-tick-text">{index + 1}.</span>
            <h2 className="mt-1 text-xl text-ink">{step.title}</h2>
            <p className="mt-2 max-w-[48ch] text-base text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
