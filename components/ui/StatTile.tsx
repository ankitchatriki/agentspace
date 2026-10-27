import { cn } from './cn';
import { StatusGlyph } from './StatusDot';

const tones = {
  neutral: { bar: 'bg-line', num: 'text-fg', box: 'border-line', status: null },
  running: { bar: 'bg-running', num: 'text-running', box: 'border-line', status: 'running' },
  waiting: { bar: 'bg-waiting', num: 'text-waiting', box: 'border-waiting/60 bg-waiting/5', status: 'waiting_on_human' },
  idle: { bar: 'bg-idle', num: 'text-idle', box: 'border-line', status: 'idle' },
} as const;

export function StatTile({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number | string;
  tone?: keyof typeof tones;
  hint?: string;
}) {
  const t = tones[tone];
  const hot = tone === 'waiting' && Number(value) > 0;
  return (
    <div className={cn('relative overflow-hidden rounded-md border bg-surface px-4 py-3', t.box, hot && 'shadow-signal')}>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', t.bar)} />
      <div className="flex items-center gap-1.5">
        {t.status && <StatusGlyph status={t.status} className={t.num} size={10} />}
        <p className="label-caps">{label}</p>
      </div>
      <p className={cn('mt-1 font-mono text-3xl font-semibold tabular-nums leading-none', t.num)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}
