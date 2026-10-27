'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Sidebar } from './Sidebar';
import type { NavItem, SidebarProject, Workspace } from './Sidebar';
import { Topbar } from './Topbar';
import type { Crumb } from './Breadcrumbs';

export type { NavItem } from './Sidebar';

const LS_KEY = 'agentspace.sidebar.collapsed';

export function AppShell({
  nav,
  activeHref,
  user,
  userMenu,
  children,
  projects,
  workspace,
  workspaces,
  onSwitchWorkspace,
  breadcrumb,
  onOpenPalette,
  topbarActions,
  contained = true,
}: {
  nav: NavItem[];
  activeHref: string;
  user: { name: string; avatarUrl?: string | null; email?: string | null };
  userMenu?: ReactNode;
  children: ReactNode;
  /** optional enterprise extras */
  projects?: SidebarProject[];
  workspace?: Workspace;
  workspaces?: Workspace[];
  onSwitchWorkspace?: (id: string) => void;
  breadcrumb?: Crumb[];
  onOpenPalette?: () => void;
  topbarActions?: ReactNode;
  /** false = render inline (styleguide preview) instead of full viewport height */
  contained?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(LS_KEY) === '1'); } catch { /* ignore */ }
  }, []);
  function toggle() {
    setCollapsed((c) => {
      try { localStorage.setItem(LS_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  }
  useEffect(() => setOpen(false), [activeHref]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (onOpenPalette) { e.preventDefault(); onOpenPalette(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenPalette]);

  const attention = nav.reduce((n, i) => n + (i.icon === 'inbox' ? (i.badge ?? 0) : 0), 0);
  const sideProps = { nav, activeHref, projects, workspace, workspaces, onSwitchWorkspace, user };

  return (
    <div className={cn('bg-canvas text-fg md:flex', contained ? 'min-h-screen' : 'h-full min-h-0')}>
      <aside
        className={cn(
          'hidden shrink-0 border-r border-line bg-surface transition-[width] duration-150 md:block',
          contained ? 'sticky top-0 h-screen' : 'h-full',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <Sidebar {...sideProps} collapsed={collapsed} onToggleCollapsed={toggle} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar {...sideProps} mobile onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          breadcrumb={breadcrumb}
          user={user}
          userMenu={userMenu}
          attention={attention}
          onOpenPalette={onOpenPalette}
          onOpenMenu={() => setOpen(true)}
          actions={topbarActions}
        />
        <main className={cn('min-w-0 flex-1', !contained && 'overflow-auto')}>
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
