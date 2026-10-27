import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from './cn';
import { Skeleton } from './Skeleton';

/** KPI card: label, big tabular value, optional delta + inline sparkline. */
export function StatCard({
  label, value, unit, delta, deltaLabel, tone = 'neutral', icon, spark, loading = false, hint,
}: {
  label: string;
  value: number | string;
  unit?: string;
  /** signed change, e.g. +12 or -3 */
  delta?: number;
  deltaLabel?: string;
  tone?: 'neutral' | 'running' | 'waiting' | 'idle' | 'danger';
  icon?: ReactNode;
  spark?: number[];
  loading?: boolean;
  hint?: string;
}) {
  const color = { neutral: 'text-fg', running: 'text-running', waiting: 'text-waiting', idle: 'text-idle', danger: 'text-danger' }[tone];
  const hot = tone === 'waiting' && Number(value) > 0;
  return (
    <div className={cn('rounded-md border bg-surface p-4', hot ? 'border-waiting/70 shadow-signal' : 'border-line')}>
      <div className="flex items-center justify-between gap-2">
        <p className="label-caps">{label}</p>
        {icon && <span className={cn('[&>svg]:h-4 [&>svg]:w-4', color)} aria-hidden>{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className={cn('font-mono text-3xl font-semibold leading-none tabular-nums', color)}>
            {value}
            {unit && <span className="ml-1 text-sm font-normal text-fg-subtle">{unit}</span>}
          </p>
          {spark && spark.length > 1 && <Sparkline data={spark} className={color} />}
        </div>
      )}
      {(delta !== undefined || hint) && !loading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
          {delta !== undefined && (
            <span className={cn('inline-flex items-center font-mono font-medium', delta >= 0 ? 'text-running' : 'text-danger')}>
              {delta >= 0 ? <ArrowUpRight aria-hidden className="h-3 w-3" /> : <ArrowDownRight aria-hidden className="h-3 w-3" />}
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
          {deltaLabel ?? hint}
        </p>
      )}
    </div>
  );
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const w = 72, h = 24;
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((d - min) / span) * (h - 4)}`).join(' ');
  return (
    <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cn('shrink-0', className)}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
