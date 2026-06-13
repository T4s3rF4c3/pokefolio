import Link from 'next/link';
import { computeMovers, computePortfolioCurve } from '@/lib/portfolio';
import PageHeader from '@/components/PageHeader';
import PortfolioChart from '@/components/PortfolioChart';
import MoversList from '@/components/MoversList';
import { cn, formatEur } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ranges = [
  { days: 7, label: '7T' },
  { days: 30, label: '30T' },
  { days: 90, label: '90T' },
  { days: 365, label: '1J' },
];

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: { r?: string };
}) {
  const days = Number(searchParams.r ?? 30);
  const [movers, curve] = await Promise.all([
    computeMovers(days),
    computePortfolioCurve(days),
  ]);

  // Every holding (Cards + CustomCards) with effective prices, value-sorted.
  const positions = movers.all;
  const trendDown = movers.totalChangeEur < 0;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-ink-300 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Zurück zum Dashboard
      </Link>

      <PageHeader
        eyebrow="Portfolio · Verlauf"
        title="Kursentwicklung"
        description="Aggregierter Wert deiner Sammlung über die Zeit. Snapshots entstehen bei jedem Preis-Sync — je öfter du syncst, desto feiner die Kurve."
        actions={
          <div className="inline-flex rounded-lg border border-white/5 bg-white/[0.02] p-1">
            {ranges.map((r) => (
              <Link
                key={r.days}
                href={`/portfolio?r=${r.days}`}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition',
                  r.days === days
                    ? 'bg-flame-500 text-white'
                    : 'text-ink-200 hover:text-white hover:bg-white/[0.04]',
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <section className="surface p-6 relative overflow-hidden">
        <div
          className={cn(
            'absolute -top-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-50',
            trendDown ? 'bg-flame-500/20' : 'bg-grass-500/20',
          )}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-ink-300">
              Aktuell
            </div>
            <div className="font-display text-3xl font-bold mt-1.5 tabular-nums">
              {formatEur(movers.totalValue)}
            </div>
            <div
              className={cn(
                'text-sm font-semibold tabular-nums mt-1 flex items-center gap-2',
                trendDown ? 'text-flame-400' : 'text-grass-400',
              )}
            >
              {trendDown ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {movers.totalChangeEur >= 0 ? '+' : ''}
              {formatEur(movers.totalChangeEur)}
              <span className="text-ink-300 font-normal">·</span>
              <span>
                {movers.totalChangePct >= 0 ? '+' : ''}
                {movers.totalChangePct.toFixed(2)}%
              </span>
              <span className="text-ink-300 font-normal">über {days} Tage</span>
            </div>
          </div>
        </div>
        <div className="relative">
          <PortfolioChart data={curve} trendDown={trendDown} height={320} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoversList title={`Top Gewinner · ${days}T`} movers={movers.gainers} tone="up" />
        <MoversList title={`Top Verlierer · ${days}T`} movers={movers.losers} tone="down" />
      </section>

      <section className="surface p-5">
        <h3 className="font-display text-sm font-semibold mb-4">
          Positionen ({positions.length})
        </h3>
        <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
          <table className="w-full text-sm tabular-nums min-w-[460px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-ink-300">
                <th className="pb-2">Karte</th>
                <th className="pb-2 text-right">Menge</th>
                <th className="pb-2 text-right hidden xs:table-cell">Kurs</th>
                <th className="pb-2 text-right hidden md:table-cell">Vor {days}T</th>
                <th className="pb-2 text-right">Δ %</th>
                <th className="pb-2 text-right">Wert</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const value = p.currentEur * p.quantity;
                const pct =
                  p.previousEur > 0 ? ((p.currentEur - p.previousEur) / p.previousEur) * 100 : 0;
                const up = pct >= 0;
                return (
                  <tr
                    key={p.cardId}
                    className="border-t border-white/5 hover:bg-white/[0.02] transition"
                  >
                    <td className="py-2.5 pr-2">
                      <Link
                        href={p.href}
                        className="flex items-center gap-2 hover:text-white"
                      >
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="h-9 w-6 rounded object-cover bg-ink-800 shrink-0"
                            loading="lazy"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-medium flex items-center gap-1.5 truncate">
                            <span className="truncate">{p.name}</span>
                            {p.isCustom && (
                              <span className="pill !text-[9px] !text-psychic-400 !border-psychic-500/30">
                                custom
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-ink-300 font-mono">
                            {p.setCode ?? '—'} {p.localId}
                            <span className="xs:hidden"> · {formatEur(p.currentEur)}</span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="text-right text-ink-200">×{p.quantity}</td>
                    <td className="text-right hidden xs:table-cell">{formatEur(p.currentEur)}</td>
                    <td className="text-right text-ink-300 hidden md:table-cell">
                      {p.previousEur > 0 ? formatEur(p.previousEur) : '—'}
                    </td>
                    <td
                      className={cn(
                        'text-right font-semibold',
                        p.previousEur === 0
                          ? 'text-ink-300'
                          : up
                            ? 'text-grass-400'
                            : 'text-flame-400',
                      )}
                    >
                      {p.previousEur === 0
                        ? '—'
                        : `${up ? '+' : ''}${pct.toFixed(1)}%`}
                    </td>
                    <td className="text-right text-white font-semibold">{formatEur(value)}</td>
                  </tr>
                );
              })}
              {positions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-300 py-8">
                    Noch keine Positionen mit Preisdaten.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
