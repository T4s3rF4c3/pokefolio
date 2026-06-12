import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Mover } from '@/lib/portfolio';
import { cn, formatEur } from '@/lib/utils';

type Props = {
  title: string;
  movers: Mover[];
  tone: 'up' | 'down';
};

export default function MoversList({ title, movers, tone }: Props) {
  const Icon = tone === 'up' ? TrendingUp : TrendingDown;
  const accent =
    tone === 'up' ? 'text-grass-400 border-grass-500/30' : 'text-flame-400 border-flame-500/30';

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={cn('rounded-md p-1.5 border bg-white/[0.02]', accent)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="font-display text-sm font-semibold">{title}</h3>
      </div>
      {movers.length === 0 ? (
        <div className="text-xs text-ink-300 py-6 text-center">
          Noch keine Veränderung — kommt nach ein paar Preis-Syncs.
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {movers.map((m) => (
            <li key={m.cardId}>
              <Link
                href={`/cards/${m.cardId}`}
                className="flex items-center gap-3 py-2.5 hover:bg-white/[0.02] -mx-2 px-2 rounded-md transition"
              >
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imageUrl}
                    alt={m.name}
                    className="h-10 w-7 object-cover rounded shrink-0 bg-ink-800"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-10 w-7 rounded bg-ink-800 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{m.name}</div>
                  <div className="text-[11px] text-ink-300 flex items-center gap-1 truncate">
                    <span className="font-mono">
                      {m.setCode ?? '—'} {m.localId}
                    </span>
                    <span>·</span>
                    <span>×{m.quantity}</span>
                    <span>·</span>
                    <span>{formatEur(m.currentEur)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={cn(
                      'font-display text-sm font-bold tabular-nums',
                      tone === 'up' ? 'text-grass-400' : 'text-flame-400',
                    )}
                  >
                    {tone === 'up' ? '+' : ''}
                    {m.changePct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-ink-300 tabular-nums">
                    {tone === 'up' ? '+' : ''}
                    {formatEur(m.positionChangeEur)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
