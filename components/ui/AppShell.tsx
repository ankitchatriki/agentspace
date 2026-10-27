'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BellRing, FolderKanban, LayoutDashboard, Menu, Users, X } from 'lucide-react';
import { cn } from './cn';
import { Avatar } from './Avatar';

export type NavItem = {
  href: string;
  label: string;
  icon: 'overview' | 'inbox' | 'projects' | 'team';
  badge?: number;
};

const ICONS = { overview: LayoutDashboard, inbox: BellRing, projects: FolderKanban, team: Users } as const;

function isActive(item: NavItem, activeHref: string): boolean {
  return activeHref === item.href || (item.href !== '/' && activeHref.startsWith(item.href));
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-fg">
      <span aria-hidden className="grid h-6 w-6 grid-cols-2 gap-[3px] rounded-sm bg-accent p-1">
        <span className="rounded-[1px] bg-accent-fg" />
        <span className="rounded-[1px] bg-accent-fg/40" />
        <span className="rounded-[1px] bg-accent-fg/40" />
        <span className="rounded-[1px] bg-waiting" />
      </span>
      <span>Agentspace</span>
    </Link>
  );
}

function NavList({ nav, activeHref, onNavigate }: { nav: NavItem[]; activeHref: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {nav.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item, activeHref);
        const hasBadge = (item.badge ?? 0) > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex h-10 items-center gap-3 rounded px-3 text-sm font-medium transition-colors',
              active ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-accent" />}
            <Icon aria-hidden className={cn('h-4 w-4', item.icon === 'inbox' && hasBadge && 'text-waiting')} />
            <span className="flex-1">{item.label}</span>
            {hasBadge && (
              <span
                aria-label={`${item.badge} need attention`}
                className="min-w-[1.5rem] animate-beacon rounded-sm bg-waiting px-1.5 py-0.5 text-center font-mono text-xs font-bold leading-none text-canvas"
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBlock({ user, userMenu }: { user: { name: string; avatarUrl?: string | null; email?: string | null }; userMenu?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={user.name} src={user.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{user.name}</p>
          {user.email && <p className="truncate font-mono text-[11px] text-fg-subtle">{user.email}</p>}
        </div>
      </div>
      {userMenu && <div>{userMenu}</div>}
    </div>
  );
}

export function AppShell({
  nav,
  activeHref,
  user,
  userMenu,
  children,
}: {
  nav: NavItem[];
  activeHref: string;
  user: { name: string; avatarUrl?: string | null; email?: string | null };
  userMenu?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [activeHref]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const attention = nav.reduce((n, i) => n + (i.icon === 'inbox' ? (i.badge ?? 0) : 0), 0);

  return (
    <div className="min-h-screen bg-canvas text-fg md:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="flex flex-col gap-6">
          <div className="px-3">
            <Brand />
          </div>
          <NavList nav={nav} activeHref={activeHref} />
        </div>
        <UserBlock user={user} userMenu={userMenu} />
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          {attention > 0 && (
            <Link
              href="/inbox"
              className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-waiting px-2 font-mono text-xs font-bold text-canvas"
              aria-label={`${attention} need attention, open inbox`}
            >
              <BellRing aria-hidden className="h-3.5 w-3.5" />
              {attention}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between border-r border-line bg-surface px-3 py-4">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between px-3">
                <Brand />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded text-fg-muted hover:bg-surface-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList nav={nav} activeHref={activeHref} onNavigate={() => setOpen(false)} />
            </div>
            <UserBlock user={user} userMenu={userMenu} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
