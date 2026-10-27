'use client';
import { useState } from 'react';
import { Button, Callout, Card, CopyField, EmptyState, Input, MemberRow, PageHeader } from '@/components/ui';
import { useTeams } from '@/lib/hooks/useTeams';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useSupabase } from '@/lib/hooks/useSupabase';
import * as api from '@/lib/client/api';
import type { TeamWithMembers } from '@/lib/types';
import { Loading } from '../_components/Loading';

function TeamCard({ team, userId, reload }: { team: TeamWithMembers; userId?: string; reload: () => Promise<void> }) {
  const supabase = useSupabase();
  const isOwner = team.my_role === 'owner';
  const [name, setName] = useState(team.name);
  const [busy, setBusy] = useState<'rename' | 'rotate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    setBusy('rename');
    setError(null);
    try {
      await api.renameTeam(team.id, name.trim());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setBusy(null);
    }
  }
  async function rotate() {
    if (!confirm('Rotate the invite code? The old link stops working.')) return;
    setBusy('rotate');
    setError(null);
    try {
      await api.rotateInviteCode(team.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotate failed');
    } finally {
      setBusy(null);
    }
  }
  async function remove(uid: string) {
    if (!confirm('Remove this member?')) return;
    const { error: err } = await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', uid);
    if (err) setError(err.message);
    else await reload();
  }

  return (
    <Card title={team.name} description={`${team.members.length} member${team.members.length === 1 ? '' : 's'}`}>
      <div className="space-y-6">
        {isOwner && (
          <form onSubmit={rename} className="flex items-end gap-3">
            <div className="flex-1">
              <Input label="Team name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <Button type="submit" variant="secondary" loading={busy === 'rename'} disabled={!name.trim() || name === team.name}>
              Rename
            </Button>
          </form>
        )}
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <CopyField label="Invite link" value={`${origin}/join/${team.invite_code}`} mono />
          </div>
          {isOwner && (
            <Button variant="secondary" onClick={rotate} loading={busy === 'rotate'}>
              Rotate
            </Button>
          )}
        </div>
        {error && <Callout tone="danger">{error}</Callout>}
        <div className="divide-y divide-line">
          {team.members.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              isYou={m.user_id === userId}
              onRemove={isOwner && m.user_id !== userId ? () => remove(m.user_id) : undefined}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function TeamPage() {
  const { teams, loading, error, reload } = useTeams();
  const { user } = useCurrentUser();

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Share the invite link with teammates so they see the same agents and requests." />
      {error ? (
        <Callout tone="danger" title="Could not load teams">{error}</Callout>
      ) : loading ? (
        <Loading />
      ) : teams.length === 0 ? (
        <EmptyState title="No teams" description="You are not a member of any team." />
      ) : (
        teams.map((t) => <TeamCard key={t.id} team={t} userId={user?.id} reload={reload} />)
      )}
    </div>
  );
}
