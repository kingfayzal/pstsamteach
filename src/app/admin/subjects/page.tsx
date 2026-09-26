import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { SubjectForm, TopicForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/ui/action-button";
import { Pill } from "@/components/ui/badges";
import { PageHeader, Section } from "@/components/ui/layout";
import { plural } from "@/lib/format";
import {
  createSubjectAction,
  createTopicAction,
  deleteTopicAction,
  renameTopicAction,
  toggleSubjectAction,
  updateSubjectAction,
} from "@/server/actions/admin";
import { requireRole } from "@/server/auth/session";
import { listSubjectsWithCounts } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  await requireRole("ADMIN");
  const subjects = await listSubjectsWithCounts();

  return (
    <>
      <PageHeader title="Subjects" description="What the platform teaches. Closing a subject hides its courses from the catalog and stops new courses and teacher applications in it." />
      <div className="space-y-14">
        <ul className="space-y-4">
          {subjects.map((s) => (
            <li key={s.id} className="relative border border-rule bg-sheet" style={{ "--subject": s.color } as CSSProperties}>
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-(--subject)" />
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 py-4 pr-5 pl-7">
                  <span className="flex-1">
                    <span className="block text-xl font-extrabold text-ink">{s.name}</span>
                    <span className="block text-sm text-muted">
                      {s.tagline}. {plural(s._count.courses, "course")}, {plural(s.topics.length, "topic")}.
                    </span>
                  </span>
                  <Pill tone={s.isActive ? "good" : "neutral"}>{s.isActive ? "Open" : "Closed"}</Pill>
                </summary>
                <div className="space-y-6 border-t border-rule py-5 pr-5 pl-7">
                  <SubjectForm action={updateSubjectAction.bind(null, s.id)} subject={s} idPrefix={s.id} submitLabel="Save subject" />
                  <div className="space-y-3 border-t border-rule pt-5">
                    <h3 className="text-base font-bold text-ink">Topics</h3>
                    <p className="text-sm text-muted">Teachers pick topics for their profile, and students filter the teacher directory by them.</p>
                    {s.topics.length ? (
                      <ul className="space-y-2">
                        {s.topics.map((topic) => (
                          <li key={topic.id} className="flex flex-wrap items-center gap-3">
                            <div className="min-w-[16rem] flex-1">
                              <TopicForm action={renameTopicAction.bind(null, topic.id)} topic={topic} idPrefix={topic.id} />
                            </div>
                            <span className="text-sm text-muted">{plural(topic._count.teachers, "teacher")}</span>
                            <ActionButton
                              action={deleteTopicAction.bind(null, topic.id)}
                              label="Remove"
                              pendingLabel="Removing…"
                              variant="danger"
                              confirm={`Remove ${topic.name}? Teachers who picked it will lose it from their profile.`}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">No topics yet.</p>
                    )}
                    <TopicForm action={createTopicAction.bind(null, s.id)} idPrefix={`new-${s.id}`} />
                  </div>
                  <div className="border-t border-rule pt-5">
                    <ActionButton
                      action={toggleSubjectAction.bind(null, s.id, !s.isActive)}
                      label={s.isActive ? "Close subject" : "Open subject"}
                      pendingLabel="Saving…"
                      variant={s.isActive ? "danger" : "primary"}
                      confirm={s.isActive ? `Close ${s.name}? Its courses will disappear from the catalog.` : undefined}
                    />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>

        <Section title="Add a subject" description="Pick a colour that's distinct from the others. It's used on course covers and tags.">
          <div className="max-w-2xl border border-dashed border-rule bg-sheet/60 p-5">
            <SubjectForm action={createSubjectAction} idPrefix="new-subject" submitLabel="Add subject" />
          </div>
        </Section>
      </div>
    </>
  );
}
