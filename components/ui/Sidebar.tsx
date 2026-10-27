'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BellRing, Check, ChevronsLeft, ChevronsUpDown, FolderKanban, LayoutDashboard, Users,
} from 'lucide-react';
import { cn } from './cn';
import { Avatar } from './Avatar';

export type NavItem = {
  href: string;
  label: string;
  icon: 'overview' | 'inbox' | 'projects' | 'team';
  badge?: number;
};
export type SidebarProject = { href: string; label: string; attention?: number; running?: number };
export type Workspace = { id: string; name: string };

const ICONS = { overview: LayoutDashboard, inbox: BellRing, projects: FolderKanban, team: Users } as const;

export function isNavActive(href: string, activeHref: string): boolean {
  return activeHref === href || (href !== '/' && activeHref.startsWith(href));
}

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size }} className="grid shrink-0 grid-cols-2 gap-[3px] rounded-sm bg-accent p-[5px]">
      <span className="rounded-[1px] bg-accent-fg" />
      <span className="rounded-[1px] bg-accent-fg/40" />
      <span className="rounded-[1px] bg-accent-fg/40" />
      <span className="rounded-[1px] bg-waiting" />
    </span>
  );
}

function WorkspaceSwitcher({
  collapsed, workspace, workspaces, onSwitch,
}: { collapsed: boolean; workspace?: Workspace; workspaces?: Workspace[]; onSwitch?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const name = workspace?.name ?? 'Agentspace';
  const canSwitch = (workspaces?.length ?? 0) > 1;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => canSwitch && setOpen((o) => !o)}
        aria-haspopup={canSwitch ? 'listbox' : undefined}
        aria-expanded={canSwitch ? open : undefined}
        aria-label={`Workspace ${name}`}
        className={cn('flex h-10 w-full items-center gap-2.5 rounded px-2 text-left transition-colors hover:bg-surface-2', collapsed && 'justify-center px-0')}
      >
        <BrandMark />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight text-fg">{name}</span>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-fg-subtle">Agentspace</span>
            </span>
            {canSwitch && <ChevronsUpDown aria-hidden className="h-3.5 w-3.5 text-fg-subtle" />}
          </>
        )}
      </button>
      {open && canSwitch && (
        <ul role="listbox" className="absolute left-0 right-0 top-11 z-50 rounded-md border border-line bg-surface p-1 shadow-raised">
          {workspaces!.map((w) => (
            <li key={w.id} role="option" aria-selected={w.id === workspace?.id}>
              <button
                type="button"
                onClick={() => { setOpen(false); onSwitch?.(w.id); }}
                className="flex h-8 w-full items-center justify-between rounded-sm px-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                <span className="truncate">{w.name}</span>
                {w.id === workspace?.id && <Check aria-hidden className="h-3.5 w-3.5 text-fg" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Sidebar({
  nav, activeHref, projects, workspace, workspaces, onSwitchWorkspace, user,
  collapsed = false, onToggleCollapsed, onNavigate, mobile = false,
}: {
  nav: NavItem[];
  activeHref: string;
  projects?: SidebarProject[];
  workspace?: Workspace;
  workspaces?: Workspace[];
  onSwitchWorkspace?: (id: string) => void;
  user: { name: string; avatarUrl?: string | null; email?: string | null };
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const c = collapsed && !mobile;
  return (
    <div className="flex h-full flex-col gap-4 px-2 py-3">
      <WorkspaceSwitcher collapsed={c} workspace={workspace} workspaces={workspaces} onSwitch={onSwitchWorkspace} />

      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isNavActive(item.href, activeHref);
          const has = (item.badge ?? 0) > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={c ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-8 items-center gap-2.5 rounded px-2.5 text-sm font-medium transition-colors',
                c && 'justify-center px-0',
                active ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
              )}
            >
              {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-fg" />}
              <Icon aria-hidden className={cn('h-4 w-4 shrink-0', item.icon === 'inbox' && has && 'text-waiting')} />
              {!c && <span className="flex-1 truncate">{item.label}</span>}
              {has && (
                <span
                  aria-label={`${item.badge} need attention`}
                  className={cn(
                    'rounded-sm bg-waiting px-1.5 py-0.5 text-center font-mono text-[11px] font-bold leading-none text-canvas',
                    c && 'absolute right-1 top-0.5 px-1 text-[10px]',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {projects && projects.length > 0 && !c && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="label-caps mb-1 px-2.5">Projects</p>
          <ul className="flex flex-col gap-0.5">
            {projects.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  onClick={onNavigate}
                  aria-current={isNavActive(p.href, activeHref) ? 'page' : undefined}
                  className={cn(
                    'flex h-7 items-center gap-2 rounded px-2.5 text-[13px] transition-colors',
                    isNavActive(p.href, activeHref) ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
                  )}
                >
                  <span aria-hidden className="font-mono text-fg-subtle">#</span>
                  <span className="flex-1 truncate">{p.label}</span>
                  {(p.attention ?? 0) > 0 ? (
                    <span className="font-mono text-[11px] font-bold text-waiting" aria-label={`${p.attention} waiting`}>▲{p.attention}</span>
                  ) : (p.running ?? 0) > 0 ? (
                    <span className="font-mono text-[11px] text-running" aria-label={`${p.running} running`}>●{p.running}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(c || !projects || projects.length === 0) && <div className="flex-1" />}

      <div className={cn('flex items-center gap-2 border-t border-line pt-3', c && 'flex-col')}>
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        {!c && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-fg">{user.name}</p>
            {user.email && <p className="truncate font-mono text-[10px] text-fg-subtle">{user.email}</p>}
          </div>
        )}
        {!mobile && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-subtle hover:bg-surface-2 hover:text-fg"
          >
            <ChevronsLeft aria-hidden className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  );
}
