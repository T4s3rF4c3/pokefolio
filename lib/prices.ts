import { prisma } from '@/lib/prisma';

/**
 * Pull Cardmarket bulk prices for every linked product across a set of
 * Card / CustomCard rows in one query, then return a fast lookup function.
 *
 * Use this from any page that needs to value a list of holdings — it lets
 * us prefer the daily Cardmarket bulk price over the TCGdex cache without
 * doing N+1 queries.
 */
export async function buildCardmarketPriceLookup(opts: {
  cardIds?: (number | null | undefined)[];
  customCardIds?: (number | null | undefined)[];
}) {
  const all = [...(opts.cardIds ?? []), ...(opts.customCardIds ?? [])].filter(
    (x): x is number => typeof x === 'number',
  );
  if (all.length === 0) return (_id?: number | null) => null;
  const rows = await prisma.cardmarketPrice.findMany({
    where: { idProduct: { in: all } },
  });
  const map = new Map(rows.map((r) => [r.idProduct, r]));
  return (id?: number | null) => (id != null ? (map.get(id) ?? null) : null);
}

type CardPriceShape = {
  cardmarketIdProduct: number | null;
  priceTrendEur: number | null;
  priceAvgEur: number | null;
};

type CustomCardPriceShape = {
  cardmarketIdProduct: number | null;
  manualPriceEur: number | null;
};

type CmRow = {
  trend: number | null;
  avg: number | null;
  low: number | null;
};

/**
 * Effective EUR price for a Card. Order of preference:
 *   1. Cardmarket bulk-catalog linked product (trend → avg → low)
 *   2. TCGdex Cardmarket cache (trend → avg)
 *   3. null
 */
export function effectiveCardPrice(
  card: CardPriceShape,
  lookup: (id?: number | null) => CmRow | null,
): number | null {
  const linked = lookup(card.cardmarketIdProduct);
  if (linked) {
    return linked.trend ?? linked.avg ?? linked.low ?? null;
  }
  return card.priceTrendEur ?? card.priceAvgEur ?? null;
}

/**
 * Effective EUR price for a CustomCard. Order of preference:
 *   1. Cardmarket bulk-catalog linked product (trend → avg → low)
 *   2. Manually entered price
 *   3. null
 */
export function effectiveCustomCardPrice(
  card: CustomCardPriceShape,
  lookup: (id?: number | null) => CmRow | null,
): number | null {
  const linked = lookup(card.cardmarketIdProduct);
  if (linked) {
    return linked.trend ?? linked.avg ?? linked.low ?? null;
  }
  return card.manualPriceEur ?? null;
}
