import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={cn('flex min-w-0 items-center gap-1', !last && 'hidden sm:flex')}>
              {i > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
              {c.href && !last ? (
                <Link href={c.href} className="truncate text-fg-muted hover:text-fg">{c.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn('truncate', last ? 'font-medium text-fg' : 'text-fg-muted')}>{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
