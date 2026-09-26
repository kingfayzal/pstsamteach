import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookSessionForm } from "@/components/forms/book-session-form";
import { PageHeader } from "@/components/ui/layout";
import { bookSessionAction } from "@/server/actions/tutoring";
import { requireRole } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { getStudentConnection } from "@/server/queries/connections";
import { labelSlotGroups } from "@/server/queries/slot-labels";
import { getBookingSlots } from "@/server/queries/teachers";

export const metadata: Metadata = { title: "Book a session" };

export default async function BookSessionPage(props: PageProps<"/learn/teachers/[connectionId]/book">) {
  const user = await requireRole("STUDENT");
  const [{ connectionId }, timeZone] = await Promise.all([props.params, getViewerTimeZone()]);
  const connection = await getStudentConnection(user.id, connectionId);
  if (!connection) notFound();
  if (connection.status !== "ACTIVE") redirect(`/learn/teachers/${connection.id}`);
  const firstName = connection.teacher.name.split(" ")[0];
  const slots = labelSlotGroups(await getBookingSlots(connection.teacher.id, user.id, timeZone), timeZone);
  const minutes = connection.teacher.teacherProfile?.sessionMinutes ?? 60;

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/learn/teachers", label: "My teachers" },
          { href: `/learn/teachers/${connection.id}`, label: connection.teacher.name },
        ]}
        title={`Book a session with ${firstName}`}
        description={`${minutes}-minute live session. Times are in your time zone (${timeZone.replace(/_/g, " ")}) and cover the next two weeks.`}
      />
      <BookSessionForm action={bookSessionAction.bind(null, connection.id)} slots={slots} firstName={firstName} />
    </>
  );
}
