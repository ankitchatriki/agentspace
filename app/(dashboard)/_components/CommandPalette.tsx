'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { agentDisplayName } from '@/lib/types';
import { useProjects } from '@/lib/hooks/useProjects';
import { useAgents } from '@/lib/hooks/useAgents';
import { useOpenRequests } from '@/lib/hooks/useRequests';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { projects } = useProjects();
  const { agents } = useAgents();
  const { requests } = useOpenRequests();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('agentspace:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('agentspace:palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      { id: 'n-overview', group: 'Go to', label: 'Overview', href: '/' },
      { id: 'n-inbox', group: 'Go to', label: 'Inbox', hint: requests.length ? `${requests.length} open` : undefined, href: '/inbox' },
      { id: 'n-projects', group: 'Go to', label: 'Projects', href: '/projects' },
      { id: 'n-team', group: 'Go to', label: 'Team', href: '/team' },
      ...requests.map((r) => ({
        id: `r-${r.id}`,
        group: 'Open requests',
        label: r.prompt.slice(0, 80),
        hint: r.agent ? agentDisplayName(r.agent) : undefined,
        href: `/inbox#req-${r.id}`,
      })),
      ...projects.map((p) => ({ id: `p-${p.id}`, group: 'Projects', label: p.name, hint: p.repo_full_name ?? undefined, href: `/projects/${p.id}` })),
      ...agents.slice(0, 100).map((a) => ({
        id: `a-${a.id}`,
        group: 'Agents',
        label: agentDisplayName(a),
        hint: [a.project?.name, a.human].filter(Boolean).join(' · '),
        href: `/agents/${a.id}`,
      })),
    ];
    const s = q.trim().toLowerCase();
    if (!s) return all.slice(0, 30);
    return all.filter((i) => `${i.label} ${i.hint ?? ''} ${i.group}`.toLowerCase().includes(s)).slice(0, 30);
  }, [q, projects, agents, requests]);

  useEffect(() => setSel(0), [q]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-canvas/70 px-4 pt-[15vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(items[sel]);
            }
          }}
          placeholder="Jump to a project, agent, request…"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">No results</li>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.id} role="option" aria-selected={i === sel}>
                {header && <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{header}</div>}
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(it)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${i === sel ? 'bg-surface-2 text-fg' : 'text-fg-muted'}`}
                >
                  <span className="truncate">{it.label}</span>
                  {it.hint && <span className="shrink-0 truncate text-xs text-fg-subtle">{it.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between border-t border-line px-4 py-2 text-[11px] text-fg-subtle">
          <span>↑↓ navigate · ↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
