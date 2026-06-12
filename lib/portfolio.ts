import { prisma } from '@/lib/prisma';

export type Mover = {
  cardId: string;
  name: string;
  setName: string | null;
  setCode: string | null;
  imageUrl: string | null;
  localId: string;
  rarity: string | null;
  currentEur: number;
  previousEur: number;
  changeEur: number;
  changePct: number;
  quantity: number;
  positionEur: number; // currentEur * quantity
  positionChangeEur: number; // (currentEur - previousEur) * quantity
};

/**
 * For every card the user holds, compare the current price to a snapshot
 * taken at least `daysBack` days ago. Falls back to the oldest snapshot
 * we have if no snapshot is that old yet.
 */
export async function computeMovers(daysBack = 7): Promise<{
  gainers: Mover[];
  losers: Mover[];
  totalValue: number;
  totalChangeEur: number;
  totalChangePct: number;
}> {
  // Pull Cardmarket bulk prices alongside each card so the linked price always
  // wins over the TCGdex Cardmarket cache.
  const items = await prisma.collectionItem.findMany({
    where: { cardId: { not: null } },
    include: {
      card: { include: { set: { select: { name: true, code: true } } } },
    },
  });
  const linkedIds = items
    .map((it) => it.card?.cardmarketIdProduct)
    .filter((x): x is number => typeof x === 'number');
  const cmPrices = linkedIds.length
    ? await prisma.cardmarketPrice.findMany({ where: { idProduct: { in: linkedIds } } })
    : [];
  const cmPriceById = new Map(cmPrices.map((p) => [p.idProduct, p]));

  // Aggregate quantities per cardId so a card held in N variants is one row.
  const holdingByCard = new Map<
    string,
    { quantity: number; card: NonNullable<(typeof items)[number]['card']> }
  >();
  for (const it of items) {
    if (!it.card) continue;
    const cur = holdingByCard.get(it.card.id);
    if (cur) {
      cur.quantity += it.quantity;
    } else {
      holdingByCard.set(it.card.id, { quantity: it.quantity, card: it.card });
    }
  }

  if (holdingByCard.size === 0) {
    return { gainers: [], losers: [], totalValue: 0, totalChangeEur: 0, totalChangePct: 0 };
  }

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Pick one reference snapshot per card: the most recent snapshot that is at
  // least `daysBack` old. SQLite-friendly: do this with raw subqueries.
  const history = await prisma.priceHistory.findMany({
    where: {
      cardId: { in: Array.from(holdingByCard.keys()) },
    },
    orderBy: { capturedAt: 'asc' },
  });

  // Group by cardId, then pick the latest entry ≤ since cutoff;
  // fall back to the oldest entry if none is older than the cutoff.
  const refByCard = new Map<string, (typeof history)[number]>();
  for (const h of history) {
    if (h.capturedAt <= since) {
      refByCard.set(h.cardId, h); // overwrites with later-but-still-old
    } else if (!refByCard.has(h.cardId)) {
      // first record for this card and it's already past the cutoff
      refByCard.set(h.cardId, h);
    }
  }

  const movers: Mover[] = [];
  let totalValue = 0;
  let totalChangeEur = 0;

  for (const [cardId, { quantity, card }] of holdingByCard) {
    const linked = card.cardmarketIdProduct
      ? cmPriceById.get(card.cardmarketIdProduct)
      : null;
    const currentEur =
      linked?.trend ?? linked?.avg ?? card.priceTrendEur ?? card.priceAvgEur ?? 0;
    if (currentEur <= 0) continue;

    const ref = refByCard.get(cardId);
    const previousEur = ref?.trendEur ?? ref?.avgEur ?? currentEur;

    const changeEur = currentEur - previousEur;
    const changePct = previousEur > 0 ? (changeEur / previousEur) * 100 : 0;

    const positionEur = currentEur * quantity;
    const positionChangeEur = changeEur * quantity;

    totalValue += positionEur;
    totalChangeEur += positionChangeEur;

    movers.push({
      cardId,
      name: card.name,
      setName: card.set?.name ?? null,
      setCode: card.set?.code ?? null,
      imageUrl: card.imageUrl,
      localId: card.localId,
      rarity: card.rarity,
      currentEur,
      previousEur,
      changeEur,
      changePct,
      quantity,
      positionEur,
      positionChangeEur,
    });
  }

  const moved = movers.filter((m) => Math.abs(m.changeEur) > 0.005);
  const gainers = [...moved]
    .filter((m) => m.changeEur > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 5);
  const losers = [...moved]
    .filter((m) => m.changeEur < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 5);

  const previousTotal = totalValue - totalChangeEur;
  const totalChangePct = previousTotal > 0 ? (totalChangeEur / previousTotal) * 100 : 0;

  return { gainers, losers, totalValue, totalChangeEur, totalChangePct };
}

export type PortfolioPoint = { capturedAt: string; value: number };

/**
 * Reconstruct a portfolio value curve from PriceHistory snapshots.
 * For each snapshot's captured day, sum (snapshot price × current quantity)
 * across the user's holdings. Quantities are taken as today's quantities
 * — the curve answers "what would my current bag be worth at that point?",
 * not "what did I own back then" (we'd need acquiredAt-aware tracking for that).
 */
export async function computePortfolioCurve(days = 90): Promise<PortfolioPoint[]> {
  const items = await prisma.collectionItem.findMany({
    where: { cardId: { not: null } },
    select: { cardId: true, quantity: true },
  });
  if (items.length === 0) return [];

  const qtyByCard = new Map<string, number>();
  for (const it of items) {
    if (!it.cardId) continue;
    qtyByCard.set(it.cardId, (qtyByCard.get(it.cardId) ?? 0) + it.quantity);
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const history = await prisma.priceHistory.findMany({
    where: {
      cardId: { in: Array.from(qtyByCard.keys()) },
      capturedAt: { gte: since },
    },
    orderBy: { capturedAt: 'asc' },
  });

  // Bucket snapshots per day (UTC) and per card. Keep the latest snapshot
  // within the day. Then sum by day.
  type Bucket = Map<string, number>;
  const dayBuckets: Map<string, Bucket> = new Map();
  for (const h of history) {
    const day = h.capturedAt.toISOString().slice(0, 10);
    let bucket = dayBuckets.get(day);
    if (!bucket) {
      bucket = new Map();
      dayBuckets.set(day, bucket);
    }
    const price = h.trendEur ?? h.avgEur ?? 0;
    bucket.set(h.cardId, price);
  }

  // Forward-fill missing prices across days using the last known value.
  const sortedDays = Array.from(dayBuckets.keys()).sort();
  const lastKnown = new Map<string, number>();
  const points: PortfolioPoint[] = [];
  for (const day of sortedDays) {
    const bucket = dayBuckets.get(day)!;
    for (const [cardId, price] of bucket) lastKnown.set(cardId, price);
    let total = 0;
    for (const [cardId, qty] of qtyByCard) {
      const price = lastKnown.get(cardId);
      if (price != null) total += price * qty;
    }
    points.push({ capturedAt: day, value: Math.round(total * 100) / 100 });
  }
  return points;
}
