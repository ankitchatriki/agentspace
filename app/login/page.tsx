'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginCard } from '@/components/ui';
import { useSupabase } from '@/lib/hooks/useSupabase';

function LoginInner() {
  const params = useSearchParams();
  const supabase = useSupabase();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') ? 'Sign-in failed. Please try again.' : null,
  );
  const rawNext = params.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  async function login() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <LoginCard onGithubLogin={login} loading={loading} error={error} />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
