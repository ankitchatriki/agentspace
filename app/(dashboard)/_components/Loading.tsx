import { SkeletonRows } from './Skeleton';

export function Loading({ rows = 4 }: { label?: string; rows?: number }) {
  return <SkeletonRows rows={rows} className="py-2" />;
}
