import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-sm bg-surface-2', className)} />;
}

export function AgentCardSkeleton() {
  return (
    <div role="status" aria-label="Loading agent" className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <div className="flex items-center gap-2"><Skeleton className="h-3 w-3 rounded-full" /><Skeleton className="h-4 w-32" /></div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function RequestCardSkeleton() {
  return (
    <div role="status" aria-label="Loading request" className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
      <div className="flex gap-2"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading table" className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, c) => <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-40' : 'w-24')} />)}
        </div>
      ))}
    </div>
  );
}
