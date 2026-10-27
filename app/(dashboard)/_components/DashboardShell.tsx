'use client';
import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell, Button } from '@/components/ui';
import type { NavItem } from '@/components/ui';
import { useOpenRequests } from '@/lib/hooks/useRequests';
import { useAgents } from '@/lib/hooks/useAgents';
import { needsTerminalAttention } from '@/lib/types';
import { CommandPalette } from './CommandPalette';

export function DashboardShell({
  user,
  children,
}: {
  user: { name: string; avatarUrl?: string | null; email?: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const { requests, count } = useOpenRequests();
  const { agents } = useAgents();
  const attention = useMemo(() => agents.filter(needsTerminalAttention).length, [agents]);
  const badge = count + attention;

  // Optional browser notifications for new requests.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(requests.map((r) => r.id));
      return;
    }
    for (const r of requests) {
      if (seen.current.has(r.id)) continue;
      seen.current.add(r.id);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          new Notification('Agentspace: agent needs you', { body: r.prompt.slice(0, 140) });
        }
      } catch {
        /* ignore */
      }
    }
  }, [requests]);
  useEffect(() => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const nav: NavItem[] = [
    { href: '/', label: 'Overview', icon: 'overview' },
    { href: '/inbox', label: 'Inbox', icon: 'inbox', badge },
    { href: '/projects', label: 'Projects', icon: 'projects' },
    { href: '/team', label: 'Team', icon: 'team' },
  ];

  return (
    <AppShell
      nav={nav}
      activeHref={pathname}
      user={user}
      userMenu={
        <>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('agentspace:palette'))}
            className="mr-2 rounded-md border border-line px-2 py-1 text-xs text-fg-muted hover:bg-surface-2"
          >
            Search <kbd className="ml-1 font-mono text-fg-subtle">⌘K</kbd>
          </button>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
        </>
      }
    >
      <CommandPalette />
      {children}
    </AppShell>
  );
}
