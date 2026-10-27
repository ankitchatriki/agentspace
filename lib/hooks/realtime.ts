'use client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';
export interface Change<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
}

/** Subscribe to postgres_changes with a unique channel name. Returns an unsubscribe fn. */
export function subscribeTable<T>(
  supabase: SupabaseClient,
  table: string,
  opts: { event?: ChangeEvent; filter?: string; label?: string },
  handler: (c: Change<T>) => void,
): () => void {
  const name = `${table}:${opts.label ?? opts.filter ?? 'all'}:${Math.random().toString(36).slice(2, 10)}`;
  const channel = supabase
    .channel(name)
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: opts.event ?? '*', schema: 'public', table, ...(opts.filter ? { filter: opts.filter } : {}) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => handler(payload as Change<T>),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
