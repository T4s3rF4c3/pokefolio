import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatEur, formatNumber, cn } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import PageHeader from '@/components/PageHeader';
import CardTile from '@/components/CardTile';
import EmptyState from '@/components/EmptyState';
import MoversList from '@/components/MoversList';
import PortfolioChart from '@/components/PortfolioChart';
import { computeMovers, computePortfolioCurve } from '@/lib/portfolio';
import {
  buildCardmarketPriceLookup,
  effectiveCardPrice,
  effectiveCustomCardPrice,
} from '@/lib/prices';
import {
  Coins,
  Library,
  Layers,
  Heart,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Activity,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

async function dashboardData() {
  const [items, customCount, setCount, wishlistCount, binderCount, movers, curve] =
    await Promise.all([
      prisma.collectionItem.findMany({
        include: {
          card: { include: { set: { select: { name: true, code: true } } } },
          customCard: true,
        },
        orderBy: { acquiredAt: 'desc' },
        take: 12,
      }),
      prisma.customCard.count(),
      prisma.cardSet.count(),
      prisma.wishlistItem.count(),
      prisma.binder.count(),
      computeMovers(7),
      computePortfolioCurve(90),
    ]);

  const allItems = await prisma.collectionItem.findMany({
    include: { card: true, customCard: true },
  });

  const lookup = await buildCardmarketPriceLookup({
    cardIds: allItems.map((it) => it.card?.cardmarketIdProduct ?? null),
    customCardIds: allItems.map((it) => it.customCard?.cardmarketIdProduct ?? null),
  });

  const totals = allItems.reduce(
    (acc, it) => {
      const qty = it.quantity ?? 1;
      acc.cards += qty;
      const trend = it.card
        ? (effectiveCardPrice(it.card, lookup) ?? 0)
        : it.customCard
          ? (effectiveCustomCardPrice(it.customCard, lookup) ?? 0)
          : 0;
      acc.value += trend * qty;
      const cost = (it.purchasePrice ?? 0) * qty;
      acc.cost += cost;
      if (trend > 0) acc.priced += qty;
      return acc;
    },
    { cards: 0, value: 0, cost: 0, priced: 0 },
  );

  return {
    items,
    customCount,
    setCount,
    wishlistCount,
    binderCount,
    totals,
    movers,
    curve,
    lookup,
  };
}

export default async function DashboardPage() {
  const data = await dashboardData();
  const pnl = data.totals.value - data.totals.cost;
  const pnlPct = data.totals.cost > 0 ? (pnl / data.totals.cost) * 100 : null;

  const dayPnl = data.movers.totalChangeEur;
  const dayPct = data.movers.totalChangePct;
  const trendDown = dayPnl < 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Portfolio"
        title="Übersicht"
        description="Echtzeit-Stand deiner Sammlung mit Cardmarket-Preisen aus TCGdex und manuell gepflegten Karten."
        actions={
          <>
            <Link href="/search" className="btn btn-ghost text-xs">
              <Search className="h-3.5 w-3.5" />
              Karten finden
            </Link>
            <Link href="/cards/new" className="btn btn-primary text-xs">
              <Plus className="h-3.5 w-3.5" />
              Custom Card
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Coins}
          label="Portfolio-Wert"
          value={formatEur(data.totals.value)}
          hint={
            pnl !== 0
              ? `${pnl >= 0 ? '+' : ''}${formatEur(pnl)}${
                  pnlPct != null ? ` · ${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%` : ''
                }`
              : 'Kein Einkaufswert hinterlegt'
          }
          accent="flame"
        />
        <StatCard
          icon={Library}
          label="Karten gesamt"
          value={formatNumber(data.totals.cards)}
          hint={`${data.totals.priced} mit Preisdaten`}
          accent="electric"
        />
        <StatCard
          icon={Sparkles}
          label="Custom Cards"
          value={formatNumber(data.customCount)}
          hint="manuell gepflegt"
          accent="psychic"
        />
        <StatCard
          icon={Layers}
          label="Sets"
          value={formatNumber(data.setCount)}
          hint={`${data.binderCount} Binder · ${data.wishlistCount} Wishlist`}
          accent="water"
        />
      </div>

      {/* Stock-style portfolio chart + headline 7d change */}
      <section className="surface p-6 relative overflow-hidden">
        <div
          className={cn(
            'absolute -top-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-50',
            trendDown ? 'bg-flame-500/20' : 'bg-grass-500/20',
          )}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-ink-300 flex items-center gap-2">
              <Activity className="h-3 w-3" />
              Portfolio · 7 Tage
            </div>
            <div className="font-display text-3xl font-bold mt-1.5 tabular-nums">
              {formatEur(data.totals.value)}
            </div>
            <div
              className={cn(
                'text-sm font-semibold tabular-nums mt-1 flex items-center gap-2',
                trendDown ? 'text-flame-400' : 'text-grass-400',
              )}
            >
              {trendDown ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {dayPnl >= 0 ? '+' : ''}
              {formatEur(dayPnl)}
              <span className="text-ink-300 font-normal">·</span>
              <span>
                {dayPct >= 0 ? '+' : ''}
                {dayPct.toFixed(2)}%
              </span>
            </div>
          </div>
          <Link
            href="/portfolio"
            className="btn btn-ghost text-xs"
            title="Details öffnen"
          >
            Verlauf öffnen →
          </Link>
        </div>
        <div className="relative">
          <PortfolioChart data={data.curve} trendDown={trendDown} height={220} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoversList title="Top Gewinner · 7d" movers={data.movers.gainers} tone="up" />
        <MoversList title="Top Verlierer · 7d" movers={data.movers.losers} tone="down" />
      </section>

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-flame-400" />
              Zuletzt hinzugefügt
            </h3>
            <p className="text-xs text-ink-300 mt-0.5">
              Die jüngsten Einträge in deiner Sammlung.
            </p>
          </div>
          <Link
            href="/collection"
            className="text-xs text-flame-400 hover:text-flame-300 transition"
          >
            Alle anzeigen →
          </Link>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Noch leer hier."
            description="Suche eine Karte und füge sie zur Sammlung hinzu, oder lege eine Custom Card an für Karten, die TCGdex nicht kennt."
            cta={{ href: '/search', label: 'Erste Karte hinzufügen' }}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data.items.map((it) => {
              const card = it.card ?? it.customCard;
              if (!card) return null;
              const isCustom = !it.card;
              const setLabel =
                it.card?.set?.name ?? it.customCard?.setNameLabel ?? it.customCard?.setCodeLabel ?? null;
              const trend = it.card
                ? effectiveCardPrice(it.card, data.lookup)
                : it.customCard
                  ? effectiveCustomCardPrice(it.customCard, data.lookup)
                  : null;
              return (
                <CardTile
                  key={it.id}
                  href={isCustom ? `/cards/custom/${it.customCardId}` : `/cards/${it.cardId}`}
                  name={card.name}
                  setLabel={setLabel}
                  localId={card.localId}
                  rarity={'rarity' in card ? card.rarity : null}
                  imageUrl={card.imageUrl}
                  trendEur={trend}
                  quantity={it.quantity}
                  isCustom={isCustom}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
