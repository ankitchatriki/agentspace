'use client';

import { Search } from 'lucide-react';
import { cn } from './cn';

export function CommandPaletteTrigger({
  onClick,
  placeholder = 'Search agents, projects, requests',
  className,
}: {
  onClick?: () => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open command palette"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        'group inline-flex h-8 items-center gap-2 rounded border border-line bg-surface px-2.5 text-sm text-fg-subtle transition-colors hover:border-fg-subtle hover:text-fg-muted',
        'md:w-72',
        className,
      )}
    >
      <Search aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden flex-1 truncate text-left md:inline">{placeholder}</span>
      <kbd className="ml-auto hidden rounded-sm border border-line bg-surface-2 px-1.5 py-px font-mono text-[10px] text-fg-muted md:inline">⌘K</kbd>
    </button>
  );
}
