'use client';

import { cn } from './cn';

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex max-w-full overflow-x-auto rounded border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  'rounded-sm px-1 font-mono text-[11px] tabular-nums',
                  active ? 'bg-accent-fg/15' : 'bg-line/60',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
