import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import { Pill } from "@/components/ui/badges";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { setProfileHiddenAction } from "@/server/actions/admin";
import { requireRole } from "@/server/auth/session";
import { listTeacherProfilesForAdmin } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Teacher directory" };

export default async function AdminTeachersPage() {
  await requireRole("ADMIN");
  const profiles = await listTeacherProfilesForAdmin();

  return (
    <>
      <PageHeader
        title="Teacher directory"
        description="Every teacher profile students can browse. Hide a profile to take it out of the directory without touching the account."
      />
      {profiles.length === 0 ? (
        <EmptyState title="No teacher profiles yet">Profiles appear here once a teacher starts filling theirs in.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[50rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink text-sm text-ink-soft">
                <th scope="col" className="py-2 pr-4 font-bold">Teacher</th>
                <th scope="col" className="py-2 pr-4 font-bold">In the directory</th>
                <th scope="col" className="py-2 pr-4 text-right font-bold">Rating</th>
                <th scope="col" className="py-2 pr-4 text-right font-bold">Students</th>
                <th scope="col" className="py-2 pr-4 text-right font-bold">Requests</th>
                <th scope="col" className="py-2 font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-rule align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/people/${p.user.id}`} className="text-base font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
                      {p.user.name}
                    </Link>
                    <p className="max-w-[28rem] truncate text-sm text-muted">{p.headline || "No headline yet"}</p>
                  </td>
                  <td className="py-3 pr-4">
                    {p.isHidden ? (
                      <Pill tone="bad">Hidden by an admin</Pill>
                    ) : p.listed ? (
                      <Pill tone="good">{p.acceptingStudents ? "Listed" : "Listed, not taking students"}</Pill>
                    ) : (
                      <span className="text-sm text-muted">{p.user.status !== "ACTIVE" ? "Account not active" : `Incomplete: ${p.gaps.length} to do`}</span>
                    )}
                  </td>
                  <td className="figures py-3 pr-4 text-right text-base text-ink-soft">{p.average ? `${p.average.toFixed(1)} (${p.reviewCount})` : "None"}</td>
                  <td className="figures py-3 pr-4 text-right text-base text-ink-soft">{p.activeStudents}</td>
                  <td className="figures py-3 pr-4 text-right text-base text-ink-soft">{p.pendingRequests}</td>
                  <td className="py-3">
                    <div className="flex flex-col items-start gap-2">
                      <Link href={`/teachers/${p.slug}`} className="text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4">
                        View profile
                      </Link>
                      <ActionButton
                        action={setProfileHiddenAction.bind(null, p.id, !p.isHidden)}
                        label={p.isHidden ? "Show in directory" : "Hide"}
                        pendingLabel="Saving…"
                        variant={p.isHidden ? "secondary" : "danger"}
                        confirm={p.isHidden ? undefined : `Hide ${p.user.name} from the directory? Current students keep working with them.`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
