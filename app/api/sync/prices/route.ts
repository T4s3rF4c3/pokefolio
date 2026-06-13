import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCardAnyLang, extractCardmarketPrices, extractTcgplayerPrices } from '@/lib/tcgdex';
import { buildCardmarketPriceLookup } from '@/lib/prices';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/sync/prices — refresh prices and append a price-history point for
 * every Card AND CustomCard referenced by the collection or wishlist.
 *
 * The recorded price is the *effective* one shown in the UI: a linked
 * Cardmarket bulk product wins (covers Japanese cards), otherwise the TCGdex
 * Cardmarket cache for cards, or the manual price for custom cards. This keeps
 * the detail-view "Kursverlauf" consistent with the displayed value.
 */
export async function POST() {
  const cardIds = new Set<string>();
  const customIds = new Set<string>();

  const [cItems, wItems] = await Promise.all([
    prisma.collectionItem.findMany({ select: { cardId: true, customCardId: true } }),
    prisma.wishlistItem.findMany({ select: { cardId: true, customCardId: true } }),
  ]);
  for (const r of [...cItems, ...wItems]) {
    if (r.cardId) cardIds.add(r.cardId);
    if (r.customCardId) customIds.add(r.customCardId);
  }

  const [cards, customCards] = await Promise.all([
    prisma.card.findMany({
      where: { id: { in: [...cardIds] } },
      select: { id: true, cardmarketIdProduct: true },
    }),
    prisma.customCard.findMany({
      where: { id: { in: [...customIds] } },
      select: { id: true, cardmarketIdProduct: true, manualPriceEur: true },
    }),
  ]);

  // One query for every linked Cardmarket bulk price.
  const lookup = await buildCardmarketPriceLookup({
    cardIds: cards.map((c) => c.cardmarketIdProduct),
    customCardIds: customCards.map((c) => c.cardmarketIdProduct),
  });

  let updated = 0;
  let failed = 0;
  const failedIds: string[] = [];

  // Cards: linked bulk price wins; otherwise refresh from TCGdex (any language).
  for (const c of cards) {
    try {
      const bulk = lookup(c.cardmarketIdProduct);
      let trend: number | null;
      let avg: number | null;
      let low: number | null;

      if (bulk) {
        trend = bulk.trend ?? null;
        avg = bulk.avg ?? null;
        low = bulk.low ?? null;
      } else {
        const found = await getCardAnyLang(c.id);
        if (!found) {
          failed++;
          failedIds.push(c.id);
          continue;
        }
        const p = extractCardmarketPrices(found.card);
        const tcgp = extractTcgplayerPrices(found.card);
        await prisma.card.update({
          where: { id: c.id },
          data: {
            priceTrendEur: p.trendEur ?? null,
            priceAvgEur: p.avgEur ?? null,
            priceLowEur: p.lowEur ?? null,
            priceTrendHoloEur: p.trendHoloEur ?? null,
            priceAvgHoloEur: p.avgHoloEur ?? null,
            priceUpdatedAt: p.updatedAt ?? new Date(),
            priceTcgpVariant: tcgp.variant,
            priceTcgpLowUsd: tcgp.lowUsd,
            priceTcgpMidUsd: tcgp.midUsd,
            priceTcgpHighUsd: tcgp.highUsd,
            priceTcgpMarketUsd: tcgp.marketUsd,
            priceTcgpUpdatedAt: tcgp.updatedAt,
          },
        });
        trend = p.trendEur ?? null;
        avg = p.avgEur ?? null;
        low = p.lowEur ?? null;
      }

      if (trend != null || avg != null || low != null) {
        await prisma.priceHistory.create({
          data: {
            cardId: c.id,
            trendEur: trend,
            avgEur: avg,
            lowEur: low,
            source: bulk ? 'cardmarket-bulk' : 'tcgdex-cardmarket',
          },
        });
      }
      updated++;
    } catch {
      failed++;
      failedIds.push(c.id);
    }
  }

  // Custom cards: linked bulk price wins; otherwise the manual price.
  for (const c of customCards) {
    try {
      const bulk = lookup(c.cardmarketIdProduct);
      const trend = bulk ? (bulk.trend ?? bulk.avg ?? bulk.low ?? null) : (c.manualPriceEur ?? null);
      if (trend != null) {
        await prisma.priceHistory.create({
          data: {
            customCardId: c.id,
            trendEur: trend,
            avgEur: bulk?.avg ?? null,
            lowEur: bulk?.low ?? null,
            source: bulk ? 'cardmarket-bulk' : 'manual',
          },
        });
        updated++;
      }
    } catch {
      failed++;
      failedIds.push(c.id);
    }
  }

  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, lastPriceSync: new Date() },
    update: { lastPriceSync: new Date() },
  });

  return NextResponse.json({
    totalCards: cardIds.size,
    totalCustom: customIds.size,
    updated,
    failed,
    failedIds: failedIds.slice(0, 10),
  });
}
