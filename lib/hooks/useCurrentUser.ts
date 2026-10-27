'use client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import { useSupabase } from './useSupabase';

export function useCurrentUser(): { user: User | null; profile: Profile | null; loading: boolean } {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setUser(data.user ?? null);
        if (data.user) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
          if (!cancelled) setProfile((p as Profile) ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return { user, profile, loading };
}
