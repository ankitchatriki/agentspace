import type { ReactNode } from 'react';
import { OctagonAlert } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  action,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-md border border-danger/40 bg-danger/5 px-6 py-10 text-center">
      <OctagonAlert aria-hidden className="mb-3 h-7 w-7 text-danger" />
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      <div className="mt-4 flex gap-2">
        {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
        {action}
      </div>
    </div>
  );
}
