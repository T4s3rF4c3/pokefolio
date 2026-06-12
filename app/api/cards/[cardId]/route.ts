import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getCard,
  cardImageUrl,
  extractCardmarketPrices,
  extractTcgplayerPrices,
} from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';

// GET /api/cards/{cardId} — fetch full card (TCGdex card by id). Hydrate DB.
export async function GET(_req: Request, { params }: { params: { cardId: string } }) {
  const cardId = params.cardId;
  let card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { set: true },
  });

  // Always refresh from TCGdex if no price or price > 7 days old.
  const stale =
    !card?.priceUpdatedAt ||
    Date.now() - new Date(card.priceUpdatedAt).getTime() > 7 * 24 * 60 * 60 * 1000;

  if (!card || stale) {
    try {
      const remote = await getCard(cardId);
      const prices = extractCardmarketPrices(remote);
      const tcgp = extractTcgplayerPrices(remote);
      const tcgpData = {
        priceTcgpVariant: tcgp.variant,
        priceTcgpLowUsd: tcgp.lowUsd,
        priceTcgpMidUsd: tcgp.midUsd,
        priceTcgpHighUsd: tcgp.highUsd,
        priceTcgpMarketUsd: tcgp.marketUsd,
        priceTcgpUpdatedAt: tcgp.updatedAt,
      };
      card = await prisma.card.upsert({
        where: { id: remote.id },
        create: {
          id: remote.id,
          setId: remote.set?.id ?? card?.setId ?? cardId.split('-')[0],
          localId: remote.localId,
          name: remote.name,
          rarity: remote.rarity,
          category: remote.category,
          hp: typeof remote.hp === 'number' ? remote.hp : null,
          types: remote.types?.join(',') ?? null,
          illustrator: remote.illustrator ?? null,
          imageUrl: cardImageUrl(remote.image, 'high'),
          imageUrlSmall: cardImageUrl(remote.image, 'low'),
          priceTrendEur: prices.trendEur ?? null,
          priceAvgEur: prices.avgEur ?? null,
          priceLowEur: prices.lowEur ?? null,
          priceTrendHoloEur: prices.trendHoloEur ?? null,
          priceAvgHoloEur: prices.avgHoloEur ?? null,
          priceUpdatedAt: prices.updatedAt ?? new Date(),
          ...tcgpData,
          lang: 'de',
        },
        update: {
          name: remote.name,
          rarity: remote.rarity,
          category: remote.category,
          hp: typeof remote.hp === 'number' ? remote.hp : null,
          types: remote.types?.join(',') ?? null,
          illustrator: remote.illustrator ?? null,
          imageUrl: cardImageUrl(remote.image, 'high'),
          imageUrlSmall: cardImageUrl(remote.image, 'low'),
          priceTrendEur: prices.trendEur ?? null,
          priceAvgEur: prices.avgEur ?? null,
          priceLowEur: prices.lowEur ?? null,
          priceTrendHoloEur: prices.trendHoloEur ?? null,
          priceAvgHoloEur: prices.avgHoloEur ?? null,
          priceUpdatedAt: prices.updatedAt ?? new Date(),
          ...tcgpData,
        },
        include: { set: true },
      });

      if (prices.trendEur != null || prices.avgEur != null || prices.lowEur != null) {
        await prisma.priceHistory.create({
          data: {
            cardId: remote.id,
            trendEur: prices.trendEur ?? null,
            avgEur: prices.avgEur ?? null,
            lowEur: prices.lowEur ?? null,
          },
        });
      }
    } catch (err) {
      if (!card) {
        return NextResponse.json(
          { error: 'Karte nicht gefunden', details: String(err) },
          { status: 404 },
        );
      }
    }
  }

  return NextResponse.json(card);
}
