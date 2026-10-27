'use client';
import { useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export function useSupabase(): SupabaseClient {
  return useMemo(() => createClient(), []);
}
