import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/filter-bar";
import { Pill } from "@/components/ui/badges";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { formatDate, formatRelative } from "@/lib/format";
import { ROLE_LABEL, STATUS_TONE, USER_STATUS_LABEL } from "@/lib/people";
import { requireRole } from "@/server/auth/session";
import { listUsers } from "@/server/queries/admin";

export const metadata: Metadata = { title: "People" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PeoplePage(props: PageProps<"/admin/people">) {
  await requireRole("ADMIN");
  const sp = await props.searchParams;
  const filters = { q: one(sp.q), role: one(sp.role), status: one(sp.status) };
  const { users, total } = await listUsers(filters);

  return (
    <>
      <PageHeader title="People" description={`${total} account${total === 1 ? "" : "s"}${users.length < total ? `, showing the newest ${users.length}` : ""}.`} />
      <FilterBar
        action="/admin/people"
        q={filters.q}
        placeholder="Name or email"
        selects={[
          { name: "role", label: "Role", value: filters.role, options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "status", label: "Status", value: filters.status, options: Object.entries(USER_STATUS_LABEL).map(([value, label]) => ({ value, label })) },
        ]}
      />
      {users.length === 0 ? (
        <EmptyState title="Nobody matches those filters" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink text-sm text-ink-soft">
                <th scope="col" className="py-2 pr-4 font-bold">Person</th>
                <th scope="col" className="py-2 pr-4 font-bold">Role</th>
                <th scope="col" className="py-2 pr-4 font-bold">Status</th>
                <th scope="col" className="py-2 pr-4 font-bold">Joined</th>
                <th scope="col" className="py-2 font-bold">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-rule">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/people/${u.id}`} className="text-base font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
                      {u.name}
                    </Link>
                    <p className="text-sm text-muted">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-base text-ink-soft">{ROLE_LABEL[u.role]}</td>
                  <td className="py-3 pr-4">
                    <Pill tone={STATUS_TONE[u.status]}>{USER_STATUS_LABEL[u.status]}</Pill>
                  </td>
                  <td className="figures py-3 pr-4 text-sm text-ink-soft">{formatDate(u.createdAt)}</td>
                  <td className="py-3 text-sm text-muted">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
