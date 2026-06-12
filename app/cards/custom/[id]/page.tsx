import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ArrowLeft, ExternalLink, Plus, Sparkles } from 'lucide-react';
import { formatDate, formatEur } from '@/lib/utils';
import AddToCollectionForm from '../../[cardId]/AddToCollectionForm';
import CustomCardActions from './CustomCardActions';
import CardCodeBadge from '@/components/CardCodeBadge';
import CardmarketLinker from '@/components/CardmarketLinker';

export const dynamic = 'force-dynamic';

export default async function CustomCardPage({ params }: { params: { id: string } }) {
  const card = await prisma.customCard.findUnique({
    where: { id: params.id },
    include: { set: true },
  });
  if (!card) notFound();

  const [items, cmProduct] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { customCardId: card.id },
      orderBy: { acquiredAt: 'desc' },
    }),
    card.cardmarketIdProduct
      ? prisma.cardmarketProduct.findUnique({
          where: { idProduct: card.cardmarketIdProduct },
          include: { price: true },
        })
      : null,
  ]);
  const inCollection = items.reduce((s, i) => s + (i.quantity ?? 1), 0);

  // Effective price source label for the badge.
  const cmTrend = cmProduct?.price?.trend ?? cmProduct?.price?.avg ?? cmProduct?.price?.low ?? null;
  const effectiveSource = cmTrend != null ? 'cardmarket-bulk' : card.manualPriceEur != null ? 'manual' : null;

  const cardmarketHref =
    card.cardmarketUrl ||
    `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${encodeURIComponent(
      `${card.name} ${card.localId}`,
    )}`;

  return (
    <div className="space-y-6">
      <Link
        href="/collection"
        className="inline-flex items-center gap-1.5 text-xs text-ink-300 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Zurück
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[22rem,1fr] gap-8">
        <div>
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
                <div className="absolute inset-0 grid place-items-center text-ink-300 p-4 text-center">
                  <div>
                    <Sparkles className="h-10 w-10 mx-auto mb-3 text-psychic-400" />
                    <div className="text-sm font-medium text-white">{card.name}</div>
                    <div className="text-xs mt-1 opacity-75">
                      {card.setNameLabel ?? card.setCodeLabel ?? '—'} · {card.localId}
                    </div>
                  </div>
                </div>
              )}
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-psychic-500/90 text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-md">
                <Sparkles className="h-3 w-3" />
                custom
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] text-ink-300">
            <a
              href={cardmarketHref}
              target="_blank"
              rel="noreferrer"
              className="surface p-2.5 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="h-3 w-3" />
              Cardmarket öffnen
            </a>
            <CustomCardActions id={card.id} />
          </div>
        </div>

        <div className="space-y-5 min-w-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-psychic-400 font-semibold flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              Custom Card
            </div>
            <h2 className="font-display text-3xl font-bold mt-1">{card.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <CardCodeBadge
                code={card.set?.code ?? card.setCodeLabel ?? card.set?.id ?? '—'}
                localId={card.localId}
              />
              {(card.setNameLabel || card.set?.name) && (
                <span className="text-sm text-ink-300">
                  {card.setNameLabel ?? card.set?.name}
                </span>
              )}
              {card.rarity && (
                <span className="text-sm text-ink-300">
                  · <span className="text-white">{card.rarity}</span>
                </span>
              )}
            </div>
          </div>

          {card.cardmarketUrl && (
            <div className="surface-glass p-3 text-xs text-ink-200 flex items-center gap-3">
              <ExternalLink className="h-3.5 w-3.5 text-flame-400 shrink-0" />
              <a
                href={card.cardmarketUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-flame-300 hover:underline"
              >
                {card.cardmarketUrl}
              </a>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-ink-300 font-semibold flex items-center gap-2">
                Cardmarket · EUR
                {effectiveSource && (
                  <span
                    className={`pill !text-[9px] ${
                      effectiveSource === 'cardmarket-bulk'
                        ? '!text-grass-400 !border-grass-500/30'
                        : '!text-psychic-400 !border-psychic-500/30'
                    }`}
                  >
                    {effectiveSource === 'cardmarket-bulk' ? 'direkt · Bulk' : 'manuell'}
                  </span>
                )}
              </h3>
              <span className="text-[10px] text-ink-300">
                Stand{' '}
                {formatDate(
                  cmProduct?.price?.capturedAt ?? card.priceUpdatedAt ?? null,
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="surface p-3 border border-flame-500/30">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
                  Trend
                </div>
                <div className="font-display text-lg font-bold text-white mt-1">
                  {formatEur(cmProduct?.price?.trend ?? null)}
                </div>
              </div>
              <div className="surface p-3 border border-electric-500/30">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
                  Avg
                </div>
                <div className="font-display text-lg font-bold text-white mt-1">
                  {formatEur(cmProduct?.price?.avg ?? null)}
                </div>
              </div>
              <div className="surface p-3 border border-water-500/30">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
                  Low
                </div>
                <div className="font-display text-lg font-bold text-white mt-1">
                  {formatEur(cmProduct?.price?.low ?? null)}
                </div>
              </div>
              <div className="surface p-3 border border-psychic-500/30">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
                  Manuell
                </div>
                <div className="font-display text-lg font-bold text-white mt-1">
                  {formatEur(card.manualPriceEur)}
                </div>
              </div>
            </div>
            <CardmarketLinker
              ownerKind="custom"
              ownerId={card.id}
              ownerName={card.name}
              currentIdProduct={card.cardmarketIdProduct}
              currentProductName={cmProduct?.name ?? null}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="surface p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
                Im Bestand
              </div>
              <div className="font-display text-lg font-bold text-white mt-1">
                {inCollection}
              </div>
            </div>
            <div className="surface p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
                Variante
              </div>
              <div className="font-display text-lg font-bold text-white mt-1">
                {card.variantHint ?? '—'}
              </div>
            </div>
          </div>

          {card.notes && (
            <div className="surface p-4 text-sm text-ink-200">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-1">
                Notiz
              </div>
              {card.notes}
            </div>
          )}

          <div className="surface p-5">
            <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-flame-400" />
              Zur Sammlung hinzufügen
            </h3>
            <AddToCollectionForm customCardId={card.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
