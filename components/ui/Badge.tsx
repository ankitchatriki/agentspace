import type { ReactNode } from 'react';
import { cn } from './cn';

const tones = {
  neutral: 'border-line text-fg-muted bg-surface-2',
  accent: 'border-accent/50 text-fg bg-accent/10',
  success: 'border-success/40 text-success bg-success/10',
  warning: 'border-waiting/50 text-waiting bg-waiting/10',
  danger: 'border-danger/40 text-danger bg-danger/10',
  info: 'border-info/40 text-info bg-info/10',
} as const;

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase leading-none tracking-wider',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
