import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ArrowLeft, ExternalLink, Heart, Plus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { cn, formatDate, formatEur, formatUsd } from '@/lib/utils';
import CardCodeBadge from '@/components/CardCodeBadge';
import AddToCollectionForm from './AddToCollectionForm';
import { getCardAnyLang } from '@/lib/tcgdex';
import { upsertTcgdexCard } from '@/lib/cards';
import CardSparkline from '@/components/CardSparkline';
import CardmarketLinker from '@/components/CardmarketLinker';
import CardImageLangPicker from '@/components/CardImageLangPicker';

export const dynamic = 'force-dynamic';

async function ensureCard(cardId: string) {
  let card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { set: true },
  });
  const stale =
    !card?.priceUpdatedAt ||
    Date.now() - new Date(card.priceUpdatedAt).getTime() > 7 * 24 * 60 * 60 * 1000;

  if (!card || stale) {
    try {
      // getCardAnyLang resolves Japanese-only cards (e.g. sv3-113 under /ja/)
      // that 404 under de/en; upsertTcgdexCard ensures the parent set exists.
      const found = await getCardAnyLang(cardId);
      if (found) {
        card = await upsertTcgdexCard(found.card, found.lang);
      }
    } catch {
      if (!card) return null;
    }
  }
  return card;
}

export default async function CardPage({ params }: { params: { cardId: string } }) {
  const card = await ensureCard(params.cardId);
  if (!card) notFound();

  const [items, history, cmProduct] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { cardId: card.id },
      orderBy: { acquiredAt: 'desc' },
    }),
    prisma.priceHistory.findMany({
      where: { cardId: card.id },
      orderBy: { capturedAt: 'asc' },
      take: 365,
    }),
    card.cardmarketIdProduct
      ? prisma.cardmarketProduct.findUnique({
          where: { idProduct: card.cardmarketIdProduct },
          include: { price: true },
        })
      : null,
  ]);
  const inCollection = items.reduce((s, i) => s + (i.quantity ?? 1), 0);

  // Prefer the linked Cardmarket bulk-catalog price over the TCGdex Cardmarket
  // cache. The TCGdex cache lives on as a fallback for un-linked cards.
  const cm = {
    trend: cmProduct?.price?.trend ?? card.priceTrendEur ?? null,
    avg: cmProduct?.price?.avg ?? card.priceAvgEur ?? null,
    low: cmProduct?.price?.low ?? card.priceLowEur ?? null,
    trendHolo: cmProduct?.price?.trendHolo ?? card.priceTrendHoloEur ?? null,
    avgHolo: cmProduct?.price?.avgHolo ?? card.priceAvgHoloEur ?? null,
    capturedAt: cmProduct?.price?.capturedAt ?? card.priceUpdatedAt,
    source: cmProduct ? ('cardmarket-bulk' as const) : ('tcgdex' as const),
  };

  const types = card.types?.split(',').filter(Boolean) ?? [];

  const sparkData = history
    .map((h) => ({
      capturedAt: h.capturedAt.toISOString(),
      price: h.trendEur ?? h.avgEur ?? 0,
    }))
    .filter((d) => d.price > 0);

  // Always end the chart on the current effective price (Cardmarket bulk wins),
  // so the Kursverlauf reflects the displayed value even between price syncs.
  const currentPrice = cm.trend ?? cm.avg ?? cm.low ?? null;
  if (currentPrice != null && currentPrice > 0) {
    sparkData.push({ capturedAt: new Date().toISOString(), price: currentPrice });
  }

  const firstPrice = sparkData[0]?.price ?? card.priceTrendEur ?? card.priceAvgEur ?? 0;
  const lastPrice = sparkData[sparkData.length - 1]?.price ?? card.priceTrendEur ?? card.priceAvgEur ?? 0;
  const sparkChange = lastPrice - firstPrice;
  const sparkPct = firstPrice > 0 ? (sparkChange / firstPrice) * 100 : 0;
  const sparkDown = sparkChange < 0;

  return (
    <div className="space-y-6">
      <Link
        href="/collection"
        className="inline-flex items-center gap-1.5 text-xs text-ink-300 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Zurück
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[22rem,1fr] gap-6 lg:gap-8">
        <div className="max-w-[20rem] mx-auto lg:max-w-none lg:mx-0 w-full">
          <div className="holo-frame">
            <div className="aspect-[63/88] relative overflow-hidden rounded-[0.75rem] bg-ink-800">
              {card.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 text-ink-300 text-xs">
                  Kein Bild vorhanden. Wähle unten eine andere Sprache als
                  Fallback.
                </div>
              )}
            </div>
          </div>
          <div className="mt-3">
            <CardImageLangPicker
              cardId={card.id}
              cardLang={card.lang}
              imageLang={card.imageLang}
              hasImage={Boolean(card.imageUrl)}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-ink-300">
            <a
              href={
                card.cardmarketIdProduct
                  ? `https://www.cardmarket.com/de/Pokemon/Products?idProduct=${card.cardmarketIdProduct}`
                  : `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${encodeURIComponent(
                      card.name + ' ' + card.localId,
                    )}`
              }
              target="_blank"
              rel="noreferrer"
              className="surface p-2.5 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="h-3 w-3" />
              Cardmarket
            </a>
            <a
              href={`https://tcgdex.dev/db/${card.id.split('-')[0]}/${card.localId}`}
              target="_blank"
              rel="noreferrer"
              className="surface p-2.5 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="h-3 w-3" />
              TCGdex
            </a>
            <Link
              href={`/sets/${card.setId}`}
              className="surface p-2.5 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3 w-3" />
              Set
            </Link>
          </div>
        </div>

        <div className="space-y-5 min-w-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-flame-400 font-semibold">
              {card.set?.series ?? 'Karte'}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1 break-words">{card.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <CardCodeBadge
                code={card.set?.code ?? card.set?.id ?? card.id.split('-')[0]}
                localId={card.localId}
              />
              {card.set?.name && (
                <span className="text-sm text-ink-300">{card.set.name}</span>
              )}
              {card.rarity && (
                <span className="text-sm text-ink-300">
                  · <span className="text-white">{card.rarity}</span>
                </span>
              )}
            </div>
          </div>

          {card.lang === 'ja' && (
            <div className="surface-glass p-3 text-xs text-ink-200 flex items-start gap-2.5 border border-electric-500/20">
              <Sparkles className="h-3.5 w-3.5 text-electric-400 shrink-0 mt-0.5" />
              <span>
                Japanische Karte: Set-/Card-ID weicht vom westlichen Druck ab (z.B.{' '}
                <code className="text-electric-300">sv3</code> statt{' '}
                <code className="text-electric-300">sv03</code>). Beim Suchen oder beim
                Cardmarket-Verknüpfen die ID bzw. den Set-Code ggf. entsprechend anpassen.
              </span>
            </div>
          )}

          {types.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {types.map((t) => (
                <span
                  key={t}
                  className="type-chip"
                  style={{
                    background:
                      ({
                        Fire: '#ff4d0a',
                        Water: '#2d8df5',
                        Grass: '#23b362',
                        Lightning: '#fdd000',
                        Psychic: '#9b53ff',
                        Fighting: '#c0392b',
                        Darkness: '#3a3a4a',
                        Metal: '#9aa6b4',
                        Fairy: '#ff7ab6',
                        Dragon: '#6c5ce7',
                        Colorless: '#cfd2e0',
                      } as Record<string, string>)[t] ?? '#1f2230',
                  }}
                >
                  {t}
                </span>
              ))}
              {card.hp && (
                <span className="pill !text-electric-500 !border-electric-500/30">
                  {card.hp} HP
                </span>
              )}
              {card.illustrator && (
                <span className="pill">Illus. {card.illustrator}</span>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink-300 font-semibold flex items-center gap-2">
                  Cardmarket · EUR
                  <span
                    className={cn(
                      'pill !text-[9px]',
                      cm.source === 'cardmarket-bulk'
                        ? '!text-grass-400 !border-grass-500/30'
                        : '!text-flame-400 !border-flame-500/30',
                    )}
                  >
                    {cm.source === 'cardmarket-bulk' ? 'direkt · Bulk' : 'via TCGdex'}
                  </span>
                </h3>
                <span className="text-[10px] text-ink-300">
                  Stand {formatDate(cm.capturedAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat title="Trend" value={formatEur(cm.trend)} accent="flame" />
                <Stat title="Avg" value={formatEur(cm.avg)} accent="electric" />
                <Stat title="Low" value={formatEur(cm.low)} accent="water" />
                <Stat title="Trend Holo" value={formatEur(cm.trendHolo)} accent="psychic" />
              </div>
              <div className="mt-3">
                <CardmarketLinker
                  ownerKind="card"
                  ownerId={card.id}
                  ownerName={card.name}
                  currentIdProduct={card.cardmarketIdProduct}
                  currentProductName={cmProduct?.name ?? null}
                />
              </div>
            </div>

            {(card.priceTcgpMarketUsd ||
              card.priceTcgpLowUsd ||
              card.priceTcgpMidUsd ||
              card.priceTcgpHighUsd) && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink-300 font-semibold flex items-center gap-2">
                    TCGplayer · USD
                    {card.priceTcgpVariant && (
                      <span className="pill !text-[9px] !text-water-400 !border-water-500/30">
                        {card.priceTcgpVariant}
                      </span>
                    )}
                  </h3>
                  <span className="text-[10px] text-ink-300">
                    Stand {formatDate(card.priceTcgpUpdatedAt)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat title="Market" value={formatUsd(card.priceTcgpMarketUsd)} accent="grass" />
                  <Stat title="Low" value={formatUsd(card.priceTcgpLowUsd)} accent="water" />
                  <Stat title="Mid" value={formatUsd(card.priceTcgpMidUsd)} accent="electric" />
                  <Stat title="High" value={formatUsd(card.priceTcgpHighUsd)} accent="flame" />
                </div>
              </div>
            )}
          </div>

          <div className="surface p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-ink-300">
                  Kursverlauf
                </div>
                <div className="font-display text-xl font-bold mt-1 tabular-nums">
                  {formatEur(lastPrice)}
                </div>
                {sparkData.length >= 2 && (
                  <div
                    className={cn(
                      'text-xs font-semibold tabular-nums mt-0.5 flex items-center gap-1.5',
                      sparkDown ? 'text-flame-400' : 'text-grass-400',
                    )}
                  >
                    {sparkDown ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5" />
                    )}
                    {sparkChange >= 0 ? '+' : ''}
                    {formatEur(sparkChange)}
                    <span className="text-ink-300 font-normal">·</span>
                    <span>
                      {sparkPct >= 0 ? '+' : ''}
                      {sparkPct.toFixed(1)}%
                    </span>
                    <span className="text-ink-300 font-normal">
                      seit {formatDate(sparkData[0].capturedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <CardSparkline data={sparkData} trendDown={sparkDown} height={140} />
          </div>

          <div className="surface p-5">
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-flame-400" />
              Zur Sammlung hinzufügen
              {inCollection > 0 && (
                <span className="pill ml-auto">×{inCollection} besessen</span>
              )}
            </h3>
            <AddToCollectionForm cardId={card.id} />
          </div>

          <details className="surface p-5">
            <summary className="cursor-pointer font-display text-sm font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-flame-400" />
              Aktuelle Sammlung ({items.length} Einträge)
            </summary>
            <div className="mt-4 space-y-2">
              {items.length === 0 ? (
                <div className="text-xs text-ink-300">Noch nicht in der Sammlung.</div>
              ) : (
                items.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between text-xs border-t border-white/5 pt-2"
                  >
                    <span>
                      ×{i.quantity} · {i.variant} · {i.condition} · {i.language}
                    </span>
                    <span className="text-ink-300">
                      {i.purchasePrice != null
                        ? `EK ${formatEur(i.purchasePrice)}`
                        : 'kein EK'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: 'flame' | 'electric' | 'water' | 'psychic' | 'grass';
}) {
  const colors: Record<typeof accent, string> = {
    flame: 'border-flame-500/30 text-flame-400',
    electric: 'border-electric-500/30 text-electric-400',
    water: 'border-water-500/30 text-water-400',
    psychic: 'border-psychic-500/30 text-psychic-400',
    grass: 'border-grass-500/30 text-grass-400',
  } as const;
  return (
    <div className={`surface p-3 border ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">{title}</div>
      <div className="font-display text-lg font-bold text-white mt-1">{value}</div>
    </div>
  );
}
