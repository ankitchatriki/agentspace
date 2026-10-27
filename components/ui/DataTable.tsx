import type { ReactNode } from 'react';
import { cn } from './cn';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { TableSkeleton } from './Skeleton';

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** tailwind width class, e.g. 'w-40' */
  width?: string;
  /** hide below md */
  hideOnMobile?: boolean;
  mono?: boolean;
};

export function DataTable<T>({
  columns, rows, rowKey, onRowClick, rowHref, loading = false, error = null, onRetry, emptyTitle = 'No results', emptyDescription, dense = false, caption,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  dense?: boolean;
  caption?: string;
}) {
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  if (loading) {
    return <div className="overflow-hidden rounded-md border border-line bg-surface"><TableSkeleton cols={Math.min(columns.length, 5)} /></div>;
  }
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const al = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;
  const pad = dense ? 'px-3 py-1.5' : 'px-4 py-2.5';
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-surface-2/50">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('label-caps whitespace-nowrap px-4 py-2 font-medium', al[c.align ?? 'left'], c.width, c.hideOnMobile && 'hidden md:table-cell')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const href = rowHref?.(r);
            return (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn('transition-colors hover:bg-surface-2/50', onRowClick && 'cursor-pointer')}
              >
                {columns.map((c, i) => (
                  <td key={c.key} className={cn(pad, 'align-middle text-fg', al[c.align ?? 'left'], c.mono && 'font-mono text-xs tabular-nums', c.hideOnMobile && 'hidden md:table-cell')}>
                    {href && i === 0 ? <a href={href} className="hover:underline">{c.cell(r)}</a> : c.cell(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
