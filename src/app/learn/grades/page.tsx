import type { Metadata } from "next";
import Link from "next/link";
import { SubjectTag } from "@/components/ui/badges";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { CircledScore } from "@/components/ui/marks";
import { formatDate } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getStudentGrades } from "@/server/queries/student";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesPage() {
  const user = await requireRole("STUDENT");
  const grades = await getStudentGrades(user.id);

  return (
    <>
      <PageHeader title="Grades" description="Every quiz attempt and assignment you've handed in, newest first." />
      {grades.length === 0 ? (
        <EmptyState title="Nothing marked yet" action={<LinkButton href="/learn">Go to your dashboard</LinkButton>}>
          Take a quiz or hand in an assignment and your results will be listed here.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink text-sm text-ink-soft">
                <th scope="col" className="py-2 pr-4 font-bold">Work</th>
                <th scope="col" className="py-2 pr-4 font-bold">Course</th>
                <th scope="col" className="py-2 pr-4 font-bold">Handed in</th>
                <th scope="col" className="py-2 font-bold">Result</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.id} className="border-b border-rule align-middle">
                  <td className="py-3 pr-4">
                    <Link href={`/learn/courses/${g.assessment.course.slug}/assessments/${g.assessment.id}?attempt=${g.id}`} className="text-base font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
                      {g.assessment.title}
                    </Link>
                    <p className="text-sm text-muted">{g.assessment.kind === "QUIZ" ? "Quiz" : "Assignment"}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-base text-ink">{g.assessment.course.title}</p>
                    <SubjectTag name={g.assessment.course.subject.name} color={g.assessment.course.subject.color} />
                  </td>
                  <td className="figures py-3 pr-4 text-base text-ink-soft">{formatDate(g.submittedAt)}</td>
                  <td className="py-3">
                    {g.status === "GRADED" ? (
                      <CircledScore score={g.score ?? 0} maxScore={g.maxScore} passPercent={g.assessment.passPercent} size="sm" />
                    ) : (
                      <span className="text-sm font-bold text-amber">Waiting for marking</span>
                    )}
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
