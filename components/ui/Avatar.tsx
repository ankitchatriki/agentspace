import { cn } from './cn';

const sizes = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-sm' } as const;

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'sm',
}: {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md';
}) {
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface-2 font-mono font-semibold text-fg-muted',
        sizes[size],
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      {!src && <span className="sr-only">{name}</span>}
    </span>
  );
}
