import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/ui/action-button";
import { CourseStatusBadge, Pill } from "@/components/ui/badges";
import { PageHeader, Section } from "@/components/ui/layout";
import { Tick } from "@/components/ui/marks";
import { formatDate, formatRelative, plural } from "@/lib/format";
import { ROLE_LABEL, STATUS_TONE, USER_STATUS_LABEL } from "@/lib/people";
import { approveTeacherAction, changeRoleAction, declineTeacherAction, reactivateUserAction, suspendUserAction } from "@/server/actions/admin";
import { requireRole } from "@/server/auth/session";
import { getUserDetail } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Person" };

export default async function PersonPage(props: PageProps<"/admin/people/[userId]">) {
  const admin = await requireRole("ADMIN");
  const { userId } = await props.params;
  const person = await getUserDetail(userId);
  if (!person) notFound();
  const isSelf = person.id === admin.id;

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/people", label: "People" }]}
        title={person.name}
        description={person.email}
        meta={
          <>
            <span className="text-base font-bold text-ink-soft">{ROLE_LABEL[person.role]}</span>
            <Pill tone={STATUS_TONE[person.status]}>{USER_STATUS_LABEL[person.status]}</Pill>
            <span className="text-sm text-muted">
              Joined {formatDate(person.createdAt)}. Last login {person.lastLoginAt ? formatRelative(person.lastLoginAt) : "never"}.
            </span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-12">
          {person.role === "TEACHER" && person.status === "PENDING" ? (
            <Section title="Teacher application">
              <p className="text-sm text-muted">Wants to teach {person.applicationSubject?.name ?? "an unspecified subject"}.</p>
              {person.applicationNote ? <p className="max-w-[70ch] border-l-2 border-rule pl-4 text-lg whitespace-pre-line text-ink-soft">{person.applicationNote}</p> : null}
              <div className="flex flex-wrap gap-3">
                <ActionButton action={approveTeacherAction.bind(null, person.id)} label="Approve as teacher" pendingLabel="Approving…" variant="primary" />
                <ActionButton action={declineTeacherAction.bind(null, person.id)} label="Decline" pendingLabel="Declining…" variant="danger" confirm="Decline this application? Their account will become a student account." />
              </div>
            </Section>
          ) : null}

          {person.bio ? (
            <Section title="Bio">
              <p className="max-w-[65ch] text-lg text-ink-soft">{person.bio}</p>
            </Section>
          ) : null}

          {person.courses.length ? (
            <Section title="Courses they teach">
              <ul className="divide-y divide-rule border-y border-rule">
                {person.courses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <Link href={`/admin/courses/${c.id}`} className="text-base font-bold text-ink underline decoration-rule underline-offset-4">
                      {c.title}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-muted">{plural(c._count.enrollments, "student")}</span>
                      <CourseStatusBadge status={c.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {person.enrollments.length ? (
            <Section title="Enrolled in" description={`${plural(person._count.submissions, "submission")} in total.`}>
              <ul className="divide-y divide-rule border-y border-rule">
                {person.enrollments.map((e) => (
                  <li key={e.course.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <Link href={`/admin/courses/${e.course.id}`} className="text-base font-bold text-ink underline decoration-rule underline-offset-4">
                      {e.course.title}
                    </Link>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      {e.completedAt ? (
                        <>
                          <Tick className="h-4 w-5" /> Completed {formatDate(e.completedAt)}
                        </>
                      ) : (
                        `Enrolled ${formatDate(e.createdAt)}`
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {isSelf ? (
            <p className="border border-rule bg-sheet p-5 text-base text-ink-soft">This is your account. Change your details from the Account page.</p>
          ) : (
            <div className="space-y-6 border border-rule bg-sheet p-5">
              <h2 className="text-xl text-ink">Account actions</h2>
              <RoleForm action={changeRoleAction.bind(null, person.id)} role={person.role} />
              <div className="border-t border-rule pt-5">
                {person.status === "SUSPENDED" ? (
                  <ActionButton action={reactivateUserAction.bind(null, person.id)} label="Reactivate account" pendingLabel="Reactivating…" variant="primary" />
                ) : (
                  <ActionButton
                    action={suspendUserAction.bind(null, person.id)}
                    label="Suspend account"
                    pendingLabel="Suspending…"
                    variant="danger"
                    confirm="Suspend this account? They'll be signed out everywhere and won't be able to log in."
                  />
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
