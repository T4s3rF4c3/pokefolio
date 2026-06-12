'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, Check } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

type Props = {
  productsCount: number;
  pricesCount: number;
};

export default function CardmarketSyncButton({ productsCount, pricesCount }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    products: number;
    prices: number;
    durationMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/cardmarket/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Fehler');
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={sync} disabled={busy} className="btn btn-primary text-xs">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {busy ? 'Synchronisiere…' : 'Cardmarket Bulk-Daten holen'}
        </button>
        {result && (
          <span className="text-xs text-grass-400 flex items-center gap-1.5">
            <Check className="h-3 w-3" />
            {formatNumber(result.products)} Produkte · {formatNumber(result.prices)} Preise · {(result.durationMs / 1000).toFixed(1)}s
          </span>
        )}
        {error && <span className="text-xs text-flame-400">{error}</span>}
      </div>
      <div className="text-[11px] text-ink-300">
        Aktuell {formatNumber(productsCount)} Produkte und {formatNumber(pricesCount)} Preise im
        lokalen Katalog. Quelle: downloads.s3.cardmarket.com (~28 MB, kein API-Key, ~5-15 s).
      </div>
    </div>
  );
}
