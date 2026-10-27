import type { AgentEvent } from '@/lib/types';
import { Button } from './Button';
import { EventItem } from './EventItem';

export function EventTimeline({
  events,
  onLoadOlder,
  loadingOlder = false,
  hasMore = false,
  emptyLabel = 'No events yet.',
}: {
  events: AgentEvent[];
  onLoadOlder?: () => void;
  loadingOlder?: boolean;
  hasMore?: boolean;
  emptyLabel?: string;
}) {
  if (events.length === 0) {
    return <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-fg-subtle">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="relative flex flex-col gap-0.5 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-line">
        {events.map((e) => (
          <EventItem key={e.id} event={e} />
        ))}
      </ol>
      {hasMore && onLoadOlder && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" loading={loadingOlder} onClick={onLoadOlder}>
            Load older
          </Button>
        </div>
      )}
    </div>
  );
}
