import 'server-only';
import type { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { error } from './http';

export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User } | { response: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: error(401, 'unauthorized') };
  return { supabase, user };
}
