import { prisma } from '@/lib/prisma';
import {
  cardImageUrl,
  extractCardmarketPrices,
  extractTcgplayerPrices,
  type TcgdexCardFull,
} from '@/lib/tcgdex';

/**
 * Ensure a CardSet row exists so a Card insert never fails its foreign key.
 * Sets that were never synced (notably Japanese sets like "SV3", which only
 * live under TCGdex's /ja/ endpoint) aren't in the catalog, so we create a
 * minimal stub from the card's embedded set info. Existing sets are left as-is.
 */
export async function ensureCardSet(
  set: { id?: string; name?: string } | undefined,
  fallbackId: string,
): Promise<string> {
  const id = set?.id ?? fallbackId;
  await prisma.cardSet.upsert({
    where: { id },
    create: { id, name: set?.name ?? id },
    update: {},
  });
  return id;
}

/**
 * Upsert a TCGdex card into the local DB, ensuring its parent set exists first.
 * `lang` is the TCGdex language the card was actually fetched under, so
 * Japanese cards are stored (and rendered with /ja/ image URLs) as "ja".
 */
export async function upsertTcgdexCard(remote: TcgdexCardFull, lang: string) {
  const setId = await ensureCardSet(remote.set, remote.id.split('-')[0]);
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
  const common = {
    name: remote.name,
    rarity: remote.rarity ?? null,
    category: remote.category ?? null,
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
  };
  return prisma.card.upsert({
    where: { id: remote.id },
    create: { id: remote.id, setId, localId: remote.localId, lang, ...common },
    update: { ...common, lang },
    include: { set: true },
  });
}
