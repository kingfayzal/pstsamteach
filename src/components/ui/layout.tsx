import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { href: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            <Link href={item.href} className="underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink">
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode;
};

export function PageHeader({ title, description, actions, crumbs, meta }: PageHeaderProps) {
  return (
    <header className="mb-8 border-b border-rule pb-6">
      {crumbs?.length ? <Breadcrumbs items={crumbs} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl text-ink">{title}</h1>
          {description ? <p className="max-w-[62ch] text-lg text-ink-soft">{description}</p> : null}
          {meta ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Section({ title, description, actions, children, className = "" }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl text-ink">{title}</h2>
          {description ? <p className="text-base text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** A white sheet on the paper background, edged with a rule line. */
export function Sheet({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border border-rule bg-sheet ${className}`}>{children}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-rule bg-sheet/60 px-6 py-10 text-center">
      <p className="text-lg font-bold text-ink">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-[52ch] text-base text-muted">{children}</div> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Label/value pairs, e.g. course facts. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="figures text-lg font-bold text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
