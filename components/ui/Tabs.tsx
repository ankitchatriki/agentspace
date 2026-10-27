'use client';

import { useRef } from 'react';
import { cn } from './cn';

export function Tabs({
  tabs, value, onChange, label = 'Sections',
}: {
  tabs: { value: string; label: string; count?: number; attention?: boolean }[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    onChange(tabs[next].value);
    (ref.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next])?.focus();
  }
  return (
    <div ref={ref} role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              '-mb-px inline-flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
              active ? 'border-fg text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-sm px-1 font-mono text-[11px] tabular-nums', t.attention ? 'bg-waiting text-canvas font-bold' : 'bg-surface-2 text-fg-muted')}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
