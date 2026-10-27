import type { TeamMemberWithProfile } from '@/lib/types';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';

export function MemberRow({ member, isYou = false, onRemove }: { member: TeamMemberWithProfile; isYou?: boolean; onRemove?: () => void }) {
  const p = member.profile;
  const name = p?.display_name ?? p?.github_login ?? p?.email ?? 'Unknown member';
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar name={name} src={p?.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">
          {name} {isYou && <span className="font-normal text-fg-subtle">(you)</span>}
        </p>
        {(p?.email || p?.github_login) && (
          <p className="truncate font-mono text-xs text-fg-subtle">{p.github_login ? `@${p.github_login}` : p.email}</p>
        )}
      </div>
      <Badge tone={member.role === 'owner' ? 'accent' : 'neutral'}>{member.role}</Badge>
      {onRemove && (
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${name}`}>
          {isYou ? 'Leave' : 'Remove'}
        </Button>
      )}
    </div>
  );
}
