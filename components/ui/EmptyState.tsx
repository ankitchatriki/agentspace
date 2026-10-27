import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={'flex flex-col items-center rounded-md border border-dashed border-line px-6 text-center ' + (compact ? 'py-6' : 'py-12')}>
      {icon && <div className="mb-3 text-fg-subtle [&>svg]:h-8 [&>svg]:w-8">{icon}</div>}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
