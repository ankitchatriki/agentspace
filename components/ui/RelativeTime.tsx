'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function RelativeTime({ iso, className, prefix }: { iso: string; className?: string; prefix?: string }) {
  // Render empty on first paint to avoid server/client hydration mismatch, then fill + tick.
  const [text, setText] = useState('');
  useEffect(() => {
    setText(fmt(iso));
    const t = setInterval(() => setText(fmt(iso)), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  const d = new Date(iso);
  const abs = Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  return (
    <time dateTime={iso} title={abs} className={className} suppressHydrationWarning>
      {prefix ? `${prefix} ` : ''}
      {text || ' '}
    </time>
  );
}
