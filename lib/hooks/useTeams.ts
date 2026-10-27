'use client';
import { useCallback, useEffect, useState } from 'react';
import type { TeamWithMembers, TeamMemberWithProfile, Team } from '@/lib/types';
import { useSupabase } from './useSupabase';

export function useTeams(): { teams: TeamWithMembers[]; loading: boolean; error: string | null; reload: () => Promise<void> } {
  const supabase = useSupabase();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [{ data: auth }, res] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('teams').select('*, team_members(*, profile:profiles(*))').order('created_at', { ascending: true }),
    ]);
    if (res.error) {
      setError(res.error.message);
      setLoading(false);
      return;
    }
    const uid = auth.user?.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (res.data ?? []) as any[];
    setTeams(
      rows.map((r) => {
        const { team_members, ...team } = r;
        const members = (team_members ?? []) as TeamMemberWithProfile[];
        const mine = members.find((m) => m.user_id === uid);
        return { ...(team as Team), members, my_role: mine?.role ?? 'member' };
      }),
    );
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { teams, loading, error, reload };
}
