import type { CSSProperties } from "react";
import type { SubjectTopics } from "@/server/queries/teachers";

/** A teacher's topics, grouped under each subject's colour. */
export function TopicTags({ subjects, compact = false }: { subjects: SubjectTopics[]; compact?: boolean }) {
  return (
    <ul className={compact ? "space-y-1" : "space-y-3"}>
      {subjects.map((subject) => (
        <li key={subject.slug} className="flex flex-wrap items-center gap-x-2 gap-y-1.5" style={{ "--subject": subject.color } as CSSProperties}>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
            <span aria-hidden="true" className="h-3 w-3 rounded-[2px] bg-(--subject)" />
            {subject.name}
          </span>
          {subject.topics.map((topic) => (
            <span key={topic.id} className="rounded-full border border-rule bg-sheet px-2.5 py-0.5 text-sm text-ink-soft">
              {topic.name}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
