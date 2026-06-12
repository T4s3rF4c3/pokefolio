'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  code: string;
  localId: string;
  className?: string;
};

/**
 * Stock-ticker-style label for a card's printed code, e.g. "OBF 205".
 * Click to copy — handy when filling out Cardmarket searches or trade lists.
 */
export default function CardCodeBadge({ code, localId, className }: Props) {
  const [copied, setCopied] = useState(false);
  const full = `${code.toUpperCase()} ${localId}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  }
  return (
    <button
      onClick={copy}
      className={cn(
        'group inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 hover:bg-white/[0.06] transition',
        className,
      )}
      title="Code kopieren"
    >
      <span className="font-mono text-xs font-semibold tracking-wider text-flame-300">
        {code.toUpperCase()}
      </span>
      <span className="font-mono text-xs font-bold tabular-nums text-white">{localId}</span>
      {copied ? (
        <Check className="h-3 w-3 text-grass-400" />
      ) : (
        <Copy className="h-3 w-3 text-ink-300 opacity-0 group-hover:opacity-100 transition" />
      )}
    </button>
  );
}
