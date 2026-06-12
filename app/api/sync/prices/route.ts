import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCard, extractCardmarketPrices, extractTcgplayerPrices } from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// POST /api/sync/prices — refresh Cardmarket prices for every Card in the
// collection (and on the wishlist). Custom cards are skipped — they need
// either a manual price update or a future Cardmarket scraper.
export async function POST() {
  const cardIds = new Set<string>();

  const collected = await prisma.collectionItem.findMany({
    where: { cardId: { not: null } },
    select: { cardId: true },
  });
  collected.forEach((c) => c.cardId && cardIds.add(c.cardId));

  const wishlisted = await prisma.wishlistItem.findMany({
    where: { cardId: { not: null } },
    select: { cardId: true },
  });
  wishlisted.forEach((c) => c.cardId && cardIds.add(c.cardId));

  let updated = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (const id of cardIds) {
    try {
      const remote = await getCard(id);
      const prices = extractCardmarketPrices(remote);
      const tcgp = extractTcgplayerPrices(remote);
      await prisma.card.update({
        where: { id },
        data: {
          priceTrendEur: prices.trendEur ?? null,
          priceAvgEur: prices.avgEur ?? null,
          priceLowEur: prices.lowEur ?? null,
          priceTrendHoloEur: prices.trendHoloEur ?? null,
          priceAvgHoloEur: prices.avgHoloEur ?? null,
          priceUpdatedAt: prices.updatedAt ?? new Date(),
          priceTcgpVariant: tcgp.variant,
          priceTcgpLowUsd: tcgp.lowUsd,
          priceTcgpMidUsd: tcgp.midUsd,
          priceTcgpHighUsd: tcgp.highUsd,
          priceTcgpMarketUsd: tcgp.marketUsd,
          priceTcgpUpdatedAt: tcgp.updatedAt,
        },
      });
      if (prices.trendEur != null || prices.avgEur != null || prices.lowEur != null) {
        await prisma.priceHistory.create({
          data: {
            cardId: id,
            trendEur: prices.trendEur ?? null,
            avgEur: prices.avgEur ?? null,
            lowEur: prices.lowEur ?? null,
          },
        });
      }
      updated++;
    } catch (err) {
      failed++;
      failedIds.push(id);
    }
  }

  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, lastPriceSync: new Date() },
    update: { lastPriceSync: new Date() },
  });

  return NextResponse.json({
    total: cardIds.size,
    updated,
    failed,
    failedIds: failedIds.slice(0, 10),
  });
}
