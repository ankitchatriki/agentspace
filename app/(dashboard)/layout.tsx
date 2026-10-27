import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from './_components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, email')
    .eq('id', user.id)
    .maybeSingle();

  const name =
    profile?.display_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.user_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'You';

  return (
    <DashboardShell
      user={{
        name,
        avatarUrl: profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null,
        email: profile?.email ?? user.email ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}
