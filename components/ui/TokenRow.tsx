import { KeyRound } from 'lucide-react';
import type { ProjectToken } from '@/lib/types';
import { cn } from './cn';
import { Badge } from './Badge';
import { Button } from './Button';
import { RelativeTime } from './RelativeTime';

export function TokenRow({ token, onRevoke, busy = false }: { token: ProjectToken; onRevoke?: () => void; busy?: boolean }) {
  const revoked = !!token.revoked_at;
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <KeyRound aria-hidden className={cn('h-4 w-4 shrink-0', revoked ? 'text-fg-subtle' : 'text-fg-muted')} />
      <div className={cn('min-w-0 flex-1', revoked && 'opacity-60')}>
        <p className="truncate text-sm font-medium text-fg">{token.label ?? 'Untitled token'}</p>
        <p className="font-mono text-xs text-fg-subtle">{token.token_prefix}…</p>
      </div>
      <div className="font-mono text-[11px] text-fg-subtle">
        <RelativeTime iso={token.created_at} prefix="created" className="block" />
        {token.last_used_at ? <RelativeTime iso={token.last_used_at} prefix="used" className="block" /> : <span className="block">never used</span>}
      </div>
      {revoked ? (
        <Badge tone="neutral">Revoked</Badge>
      ) : (
        onRevoke && (
          <Button variant="danger" size="sm" loading={busy} onClick={onRevoke} aria-label={`Revoke token ${token.label ?? token.token_prefix}`}>
            Revoke
          </Button>
        )
      )}
    </div>
  );
}
