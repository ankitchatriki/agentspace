'use client';

import { useId, useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { cn } from './cn';

export function CopyField({
  value,
  label,
  secret = false,
  mono = true,
}: {
  value: string;
  label?: string;
  secret?: boolean;
  mono?: boolean;
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(!secret);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  const shown = revealed ? value : '•'.repeat(Math.min(Math.max(value.length, 8), 32));
  const btn =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-line/60 hover:text-fg';
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="label-caps">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1 rounded border border-line bg-surface-2 pl-3 pr-1">
        <input
          id={id}
          readOnly
          value={shown}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={label ?? 'Value'}
          className={cn('h-10 min-w-0 flex-1 bg-transparent text-sm text-fg focus:outline-none', mono && 'font-mono text-xs')}
        />
        {secret && (
          <button
            type="button"
            className={btn}
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Hide value' : 'Reveal value'}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button type="button" className={cn(btn, copied && 'text-success')} onClick={copy} aria-label={copied ? 'Copied' : 'Copy to clipboard'}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
