import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { VideoEmbed } from "@/components/course/video-embed";
import { ReviewForm } from "@/components/forms/review-form";
import { ProfilePanel } from "@/components/teachers/profile-panel";
import { RatingSummary, Stars } from "@/components/teachers/rating";
import { TeacherAvatar } from "@/components/teachers/teacher-avatar";
import { AvailabilityTimetable } from "@/components/teachers/timetable";
import { TopicTags } from "@/components/teachers/topic-tags";
import { Breadcrumbs, Section } from "@/components/ui/layout";
import { Tick } from "@/components/ui/marks";
import { formatDate, plural } from "@/lib/format";
import { saveReviewAction } from "@/server/actions/find-teacher";
import { getCurrentUser } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { getTeacherProfilePage } from "@/server/queries/teachers";

export async function generateMetadata(props: PageProps<"/teachers/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getTeacherProfilePage(slug, { timeZone: "UTC" });
  return data ? { title: `${data.profile.name}, ${data.profile.subjects[0]?.name ?? ""} teacher`, description: data.profile.headline } : { title: "Teacher not found" };
}

function Paragraphs({ text }: { text: string }) {
  return <p className="max-w-[68ch] text-lg leading-relaxed whitespace-pre-line text-ink-soft">{text}</p>;
}

export default async function TeacherProfilePage(props: PageProps<"/teachers/[slug]">) {
  const [{ slug }, user, timeZone] = await Promise.all([props.params, getCurrentUser(), getViewerTimeZone()]);
  const data = await getTeacherProfilePage(slug, { id: user?.id, role: user?.role, timeZone });
  if (!data) notFound();
  const { profile, stats, reviews, courses, viewerRelation } = data;
  const firstName = profile.name.split(" ")[0];
  const color = profile.subjects[0]?.color;
  const isOwner = user?.id === profile.teacherId;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-8" style={{ "--subject": color } as CSSProperties}>
      <Breadcrumbs
        items={[
          { href: "/teachers", label: "Teachers" },
          ...(profile.subjects[0] ? [{ href: `/teachers?subject=${profile.subjects[0].slug}`, label: profile.subjects[0].name }] : []),
        ]}
      />

      {!data.isListed ? (
        <p className="mb-6 border border-amber/30 bg-amber-wash px-4 py-3 text-base font-bold text-amber">
          {data.isHidden ? "An admin has hidden this profile from the directory." : `Not in the directory yet: ${data.gaps.join(" ")}`}
        </p>
      ) : null}

      <header className="flex flex-col gap-6 border-b border-rule pb-8 sm:flex-row sm:items-start">
        <TeacherAvatar name={profile.name} photo={profile.photo} color={color} size="xl" />
        <div className="min-w-0 space-y-3">
          <h1 className="text-4xl text-ink">{profile.name}</h1>
          <p className="max-w-[40ch] text-2xl leading-snug font-bold text-ink-soft">{profile.headline}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <RatingSummary average={stats.average} count={stats.reviewCount} size="lg" />
            <span className="figures text-base text-ink-soft">
              {plural(stats.students, "student")}, {plural(stats.sessionsTaught, "session")} taught
            </span>
          </div>
          <p className="flex items-center gap-2 text-sm font-bold text-tick-text">
            <Tick className="h-4 w-5" /> Approved by our team
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-14">
          {profile.videoUrl ? (
            <Section title={`Meet ${firstName}`}>
              <VideoEmbed url={profile.videoUrl} title={`${profile.name}'s introduction`} />
            </Section>
          ) : null}

          <Section title="About me">
            <Paragraphs text={profile.about} />
          </Section>

          {profile.teachingStyle ? (
            <Section title="How I teach">
              <Paragraphs text={profile.teachingStyle} />
            </Section>
          ) : null}

          {profile.qualifications || profile.experienceYears ? (
            <Section title="Experience and qualifications">
              {profile.experienceYears ? <p className="text-lg font-bold text-ink">{plural(profile.experienceYears, "year")} teaching</p> : null}
              {profile.qualifications ? <Paragraphs text={profile.qualifications} /> : null}
            </Section>
          ) : null}

          <Section title="What I teach">
            <TopicTags subjects={profile.subjects} />
            <p className="text-base text-ink-soft">Teaches in {profile.languages.join(", ")}.</p>
          </Section>

          <Section title="When I teach" description="Filled squares are times I usually teach. Pick an exact time when you choose me.">
            {data.hasAvailability ? <AvailabilityTimetable table={data.timetable} timeZone={timeZone} /> : <p className="text-base text-muted">No regular times set yet.</p>}
          </Section>

          {courses.length ? (
            <Section title={`Courses by ${firstName}`}>
              <ul className="divide-y divide-rule border-y border-rule">
                {courses.map((course) => (
                  <li key={course.id} className="relative py-4 pl-5" style={{ "--c": course.subject.color } as CSSProperties}>
                    <span aria-hidden="true" className="absolute top-4 bottom-4 left-0 w-1.5 rounded-full bg-(--c)" />
                    <Link href={`/courses/${course.slug}`} className="text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                      {course.title}
                    </Link>
                    <p className="text-base text-ink-soft">{course.summary}</p>
                    <p className="text-sm text-muted">
                      {course.subject.name}, {plural(course._count.lessons, "lesson")}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title={stats.reviewCount ? `What students say (${stats.reviewCount})` : "What students say"}>
            {reviews.length === 0 ? (
              <p className="text-base text-muted">No reviews yet. Students can review {firstName} after their first session.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {reviews.map((review) => (
                  <li key={review.id} className="space-y-1.5 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Stars rating={review.rating} />
                      <span className="text-sm font-bold text-ink">{review.author}</span>
                      <span className="text-sm text-muted">{formatDate(review.createdAt)}</span>
                    </div>
                    <p className="max-w-[68ch] text-base whitespace-pre-line text-ink-soft">{review.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {viewerRelation.canReview ? (
              <div className="border border-rule bg-sheet p-5">
                <h3 className="mb-4 text-lg text-ink">{viewerRelation.ownReview ? "Your review" : `Review ${firstName}`}</h3>
                <ReviewForm action={saveReviewAction.bind(null, profile.teacherId, profile.slug)} existing={viewerRelation.ownReview} teacherFirstName={firstName} />
              </div>
            ) : null}
          </Section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <ProfilePanel
            teacherId={profile.teacherId}
            slug={profile.slug}
            firstName={firstName}
            acceptingStudents={profile.acceptingStudents}
            sessionMinutes={profile.sessionMinutes}
            nextSlot={data.nextSlot}
            timeZone={timeZone}
            viewer={{ id: user?.id, role: user?.role }}
            isOwner={isOwner}
            relation={viewerRelation}
          />
        </aside>
      </div>
    </div>
  );
}
