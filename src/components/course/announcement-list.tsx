import Link from "next/link";
import { formatRelative } from "@/lib/format";

type Announcement = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  author?: { name: string } | null;
  course?: { title: string; slug: string } | null;
};

export function AnnouncementList({ items, linkBase = "/learn/courses" }: { items: Announcement[]; linkBase?: string }) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {items.map((item) => (
        <li key={item.id} className="py-4">
          <p className="text-sm text-muted">
            {item.course ? (
              <Link href={`${linkBase}/${item.course.slug}`} className="font-bold text-ink-soft hover:text-ink">
                {item.course.title}
              </Link>
            ) : (
              <span className="font-bold text-ink-soft">From the platform team</span>
            )}
            <span>, {formatRelative(item.createdAt)}</span>
          </p>
          <p className="mt-1 text-lg font-bold text-ink">{item.title}</p>
          <p className="mt-1 max-w-[65ch] text-base whitespace-pre-line text-ink-soft">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}
