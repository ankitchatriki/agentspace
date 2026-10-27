import { Spinner } from '@/components/ui';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-fg-muted">
      <Spinner size="sm" /> {label}
    </div>
  );
}
