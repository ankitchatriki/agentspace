import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import { cn } from './cn';

const tones = {
  info: { box: 'border-info/40 bg-info/10', icon: 'text-info', Icon: Info },
  success: { box: 'border-success/40 bg-success/10', icon: 'text-success', Icon: CheckCircle2 },
  warning: { box: 'border-waiting/60 bg-waiting/10', icon: 'text-waiting', Icon: AlertTriangle },
  danger: { box: 'border-danger/50 bg-danger/10', icon: 'text-danger', Icon: OctagonAlert },
} as const;

export function Callout({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded border-l-4 border px-4 py-3', t.box)}
    >
      <t.Icon aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', t.icon)} />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children && <div className={cn('text-fg-muted', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
