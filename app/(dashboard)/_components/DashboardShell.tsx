'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell, Button } from '@/components/ui';
import type { NavItem, SidebarProject } from '@/components/ui';
import { useProjects } from '@/lib/hooks/useProjects';
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
  const { projects } = useProjects();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sidebarProjects = useMemo<SidebarProject[]>(
    () =>
      projects.slice(0, 12).map((p) => ({
        href: `/projects/${p.id}`,
        label: p.name,
        attention: agents.filter((a) => a.project_id === p.id && a.status === 'waiting_on_human').length,
        running: agents.filter((a) => a.project_id === p.id && a.status === 'running').length,
      })),
    [projects, agents],
  );
  const breadcrumb = useMemo(() => {
    const seg = pathname.split('/').filter(Boolean);
    const names: Record<string, string> = { inbox: 'Inbox', projects: 'Projects', team: 'Team', agents: 'Agents', join: 'Join', connect: 'Connect' };
    if (seg.length === 0) return [{ label: 'Overview' }];
    const crumbs: { href?: string; label: string }[] = [{ href: '/', label: 'Overview' }];
    seg.forEach((s, i) => {
      const label = names[s] ?? (s.length > 12 ? s.slice(0, 8) + '…' : s);
      crumbs.push(i === seg.length - 1 ? { label } : { href: '/' + seg.slice(0, i + 1).join('/'), label });
    });
    return crumbs;
  }, [pathname]);

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
      projects={sidebarProjects}
      breadcrumb={breadcrumb}
      onOpenPalette={() => setPaletteOpen((o) => !o)}
      userMenu={
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      }
    >
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {children}
    </AppShell>
  );
}
