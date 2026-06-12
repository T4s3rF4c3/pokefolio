'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Link2, Link2Off, Check, Loader2, ExternalLink } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';

type Product = {
  idProduct: number;
  name: string;
  idExpansion: number;
  idMetacard: number | null;
  price: {
    avg: number | null;
    low: number | null;
    trend: number | null;
    avgHolo: number | null;
    lowHolo: number | null;
    trendHolo: number | null;
  } | null;
};

type Props = {
  ownerKind: 'card' | 'custom';
  ownerId: string;
  ownerName: string;
  currentIdProduct?: number | null;
  currentProductName?: string | null;
};

/**
 * Cardmarket product picker.
 *
 * Used on Card and CustomCard detail pages. Searches against the locally
 * synced Cardmarket bulk catalog and lets the user pin a single idProduct
 * to the card. Once linked, the daily price guide drives the displayed
 * Cardmarket EUR values.
 */
export default function CardmarketLinker({
  ownerKind,
  ownerId,
  ownerName,
  currentIdProduct,
  currentProductName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(ownerName);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/cardmarket/products?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as Product[];
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [q, open]);

  async function link(idProduct: number | null) {
    setLinking(true);
    try {
      const body =
        ownerKind === 'card'
          ? { cardId: ownerId, idProduct }
          : { customCardId: ownerId, idProduct };
      const res = await fetch('/api/cardmarket/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setLinking(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition',
          currentIdProduct
            ? 'border-grass-500/40 bg-grass-500/10 text-grass-300 hover:bg-grass-500/15'
            : 'border-white/10 bg-white/[0.02] text-ink-200 hover:bg-white/[0.06] hover:text-white',
        )}
      >
        {currentIdProduct ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
        {currentIdProduct
          ? `verknüpft · #${currentIdProduct}`
          : 'Cardmarket-Produkt verknüpfen'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur px-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-white/5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-flame-400 font-semibold mb-1">
                Cardmarket-Produkt verknüpfen
              </div>
              <h2 className="font-display text-lg font-bold mb-4">{ownerName}</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Suche im lokalen Cardmarket-Katalog…"
                  className="input w-full pl-9"
                />
              </div>
              <div className="text-[11px] text-ink-300 mt-2">
                Aus dem täglich gesicherten Bulk-Katalog (gefiltert auf Pokémon
                Singles). Wenn du nichts findest, in den Einstellungen den
                Cardmarket-Sync auslösen.
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="text-xs text-ink-300 py-10 text-center flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  lade…
                </div>
              ) : results.length === 0 ? (
                <div className="text-xs text-ink-300 py-10 text-center">
                  Keine Treffer. Tippe mehr / weniger oder spezifischer.
                </div>
              ) : (
                <ul className="space-y-1">
                  {results.map((p) => {
                    const active = p.idProduct === currentIdProduct;
                    const trend = p.price?.trend ?? p.price?.avg ?? p.price?.low ?? null;
                    return (
                      <li key={p.idProduct}>
                        <button
                          onClick={() => link(p.idProduct)}
                          disabled={linking}
                          className={cn(
                            'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition',
                            active
                              ? 'bg-grass-500/10 border border-grass-500/40'
                              : 'hover:bg-white/[0.03] border border-transparent',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{p.name}</div>
                            <div className="text-[11px] text-ink-300 font-mono mt-0.5">
                              #{p.idProduct} · exp {p.idExpansion}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold tabular-nums text-white">
                              {trend != null ? formatEur(trend) : '—'}
                            </div>
                            {p.price?.low != null && (
                              <div className="text-[10px] text-ink-300">
                                ab {formatEur(p.price.low)}
                              </div>
                            )}
                          </div>
                          {active && <Check className="h-4 w-4 text-grass-400" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-3 border-t border-white/5 flex items-center justify-between">
              {currentIdProduct ? (
                <button
                  onClick={() => link(null)}
                  disabled={linking}
                  className="btn btn-ghost text-xs"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                  Verknüpfung lösen
                </button>
              ) : (
                <span className="text-[11px] text-ink-300">
                  {currentProductName ?? ''}
                </span>
              )}
              {currentIdProduct && (
                <a
                  href={`https://www.cardmarket.com/de/Pokemon/Products/Singles?idProduct=${currentIdProduct}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  auf Cardmarket öffnen
                </a>
              )}
              <button onClick={() => setOpen(false)} className="btn btn-ghost text-xs">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
