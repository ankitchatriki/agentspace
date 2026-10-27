import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function AgentGroup({
  title,
  subtitle,
  count,
  href,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  count: number;
  href?: string;
  children: ReactNode;
}) {
  const heading = (
    <span className="inline-flex items-center gap-1 text-sm font-semibold tracking-tight text-fg">
      {title}
      {href && <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-fg-subtle" />}
    </span>
  );
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line pb-2">
        {href ? (
          <Link href={href} className="hover:underline">
            {heading}
          </Link>
        ) : (
          heading
        )}
        <span className="rounded-sm bg-surface-2 px-1.5 font-mono text-[11px] tabular-nums text-fg-muted">{count}</span>
        {subtitle && <span className="text-xs text-fg-subtle">{subtitle}</span>}
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
