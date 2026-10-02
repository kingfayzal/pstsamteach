import type { Metadata } from "next";
import { DirectoryFilterBar } from "@/components/teachers/directory-filters";
import { TeacherRow } from "@/components/teachers/teacher-row";
import { EmptyState } from "@/components/ui/layout";
import { parseDirectoryFilters } from "@/lib/teacher-directory";
import { getCurrentUser } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { listDirectory, listSubjectsWithTopics } from "@/server/queries/teachers";

export const metadata: Metadata = {
  title: "Find a teacher",
  description: "Browse approved teachers by subject, language and time, and choose the one you connect with.",
};

export default async function TeachersPage(props: PageProps<"/teachers">) {
  const [params, user, timeZone, subjects] = await Promise.all([props.searchParams, getCurrentUser(), getViewerTimeZone(), listSubjectsWithTopics()]);
  const filters = parseDirectoryFilters(params);
  const isStudent = user?.role === "STUDENT";
  const teachers = await listDirectory(filters, { id: user?.id, role: user?.role, timeZone });
  const subject = subjects.find((s) => s.slug === filters.subject);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-8">
      <div className="max-w-[46rem] space-y-3">
        <h1 className="text-4xl text-ink">{subject ? `${subject.name} teachers` : "Find a teacher"}</h1>
        <p className="text-lg text-ink-soft">
          Every teacher here has been approved by our team. Read their profiles, watch their introductions, and choose the one you feel you&rsquo;ll learn best with.
        </p>
      </div>

      <div className="mt-8">
        <DirectoryFilterBar filters={filters} subjects={subjects} showSaved={isStudent} />
      </div>

      <p className="mt-6 text-base text-ink-soft" role="status">
        {teachers.length === 1 ? "1 teacher matches." : `${teachers.length} teachers match.`}
      </p>

      {teachers.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No teachers match those filters">Try another day or time of day, or clear a filter. New teachers join every week.</EmptyState>
        </div>
      ) : (
        <ul className="mt-2 border-t border-rule">
          {teachers.map((teacher) => (
            <TeacherRow key={teacher.profileId} teacher={teacher} viewerTimeZone={timeZone} canSave={isStudent} />
          ))}
        </ul>
      )}
    </div>
  );
}
