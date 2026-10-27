import { cn } from './cn';
import { Avatar } from './Avatar';

export function AvatarStack({
  people, max = 4, size = 'xs',
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center" role="group" aria-label={`${people.length} people: ${people.map((p) => p.name).join(', ')}`}>
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className={cn('rounded-sm ring-2 ring-surface', i > 0 && '-ml-0.5')}>
          <Avatar name={p.name} src={p.src} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-0.5 inline-flex h-5 items-center rounded-sm bg-surface-2 px-1 font-mono text-[10px] text-fg-muted ring-2 ring-surface">+{extra}</span>
      )}
    </div>
  );
}
