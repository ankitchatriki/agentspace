'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from './cn';

export function CodeBlock({
  code,
  language,
  title,
  copyable = true,
}: {
  code: string;
  language?: string;
  title?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <figure className="overflow-hidden rounded-md border border-line bg-canvas">
      {(title || language || copyable) && (
        <figcaption className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-1.5">
          <span className="truncate font-mono text-xs text-fg-subtle">{title ?? language ?? ''}</span>
          {copyable && (
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? 'Copied' : 'Copy code'}
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-sm px-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors',
                copied ? 'text-success' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </figcaption>
      )}
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-fg">
        <code data-language={language}>{code}</code>
      </pre>
    </figure>
  );
}
