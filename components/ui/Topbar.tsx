'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BellRing, Menu } from 'lucide-react';
import { Avatar } from './Avatar';
import { Breadcrumbs } from './Breadcrumbs';
import type { Crumb } from './Breadcrumbs';
import { CommandPaletteTrigger } from './CommandPaletteTrigger';

export function Topbar({
  breadcrumb, user, userMenu, attention = 0, onOpenPalette, onOpenMenu, actions,
}: {
  breadcrumb?: Crumb[];
  user: { name: string; avatarUrl?: string | null; email?: string | null };
  userMenu?: ReactNode;
  attention?: number;
  onOpenPalette?: () => void;
  onOpenMenu?: () => void;
  actions?: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-canvas/90 px-3 backdrop-blur md:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">{breadcrumb && <Breadcrumbs items={breadcrumb} />}</div>
      <CommandPaletteTrigger onClick={onOpenPalette} />
      {actions}
      {attention > 0 && (
        <Link
          href="/inbox"
          aria-label={`${attention} need attention, open inbox`}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-waiting/70 bg-waiting/10 px-2 font-mono text-xs font-bold text-waiting hover:bg-waiting/20"
        >
          <BellRing aria-hidden className="h-3.5 w-3.5" />
          {attention}
        </Link>
      )}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label="User menu"
          className="rounded focus-visible:outline-offset-2"
        >
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 top-10 z-50 w-60 rounded-md border border-line bg-surface p-3 shadow-raised">
            <p className="truncate text-sm font-medium text-fg">{user.name}</p>
            {user.email && <p className="mb-3 truncate font-mono text-[11px] text-fg-subtle">{user.email}</p>}
            {userMenu}
          </div>
        )}
      </div>
    </header>
  );
}
