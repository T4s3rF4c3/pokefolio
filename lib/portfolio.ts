import { prisma } from '@/lib/prisma';

export type Mover = {
  cardId: string; // owner id (Card or CustomCard)
  href: string; // detail link (/cards/… or /cards/custom/…)
  isCustom: boolean;
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

type Holding = {
  key: string; // 'card:<id>' | 'custom:<id>'
  id: string;
  isCustom: boolean;
  href: string;
  name: string;
  setName: string | null;
  setCode: string | null;
  imageUrl: string | null;
  localId: string;
  rarity: string | null;
  quantity: number;
  currentEur: number;
};

/**
 * Every collection holding (Cards + CustomCards) with its current *effective*
 * EUR price: a linked Cardmarket bulk product wins, else the TCGdex cache for
 * cards / the manual price for custom cards. Quantities are aggregated per card.
 */
async function loadHoldings(): Promise<Holding[]> {
  const items = await prisma.collectionItem.findMany({
    include: {
      card: { include: { set: { select: { name: true, code: true } } } },
      customCard: { include: { set: { select: { name: true, code: true } } } },
    },
  });

  const linkedIds = items
    .flatMap((it) => [it.card?.cardmarketIdProduct, it.customCard?.cardmarketIdProduct])
    .filter((x): x is number => typeof x === 'number');
  const cmPrices = linkedIds.length
    ? await prisma.cardmarketPrice.findMany({ where: { idProduct: { in: linkedIds } } })
    : [];
  const cmById = new Map(cmPrices.map((p) => [p.idProduct, p]));
  const bulk = (id: number | null | undefined): number | null => {
    const row = id != null ? cmById.get(id) : null;
    return row ? (row.trend ?? row.avg ?? row.low ?? null) : null;
  };

  const byKey = new Map<string, Holding>();
  for (const it of items) {
    let h: Holding | null = null;
    if (it.card) {
      const c = it.card;
      h = {
        key: `card:${c.id}`,
        id: c.id,
        isCustom: false,
        href: `/cards/${c.id}`,
        name: c.name,
        setName: c.set?.name ?? null,
        setCode: c.set?.code ?? null,
        imageUrl: c.imageUrl,
        localId: c.localId,
        rarity: c.rarity,
        quantity: 0,
        currentEur: bulk(c.cardmarketIdProduct) ?? c.priceTrendEur ?? c.priceAvgEur ?? 0,
      };
    } else if (it.customCard) {
      const c = it.customCard;
      h = {
        key: `custom:${c.id}`,
        id: c.id,
        isCustom: true,
        href: `/cards/custom/${c.id}`,
        name: c.name,
        setName: c.set?.name ?? c.setNameLabel ?? null,
        setCode: c.set?.code ?? c.setCodeLabel ?? null,
        imageUrl: c.imageUrl,
        localId: c.localId,
        rarity: c.rarity,
        quantity: 0,
        currentEur: bulk(c.cardmarketIdProduct) ?? c.manualPriceEur ?? 0,
      };
    }
    if (!h) continue;
    const existing = byKey.get(h.key);
    if (existing) existing.quantity += it.quantity;
    else {
      h.quantity = it.quantity;
      byKey.set(h.key, h);
    }
  }
  return Array.from(byKey.values());
}

function historyWhere(cardIds: string[], customIds: string[], extra?: object) {
  const or = [
    cardIds.length ? { cardId: { in: cardIds } } : undefined,
    customIds.length ? { customCardId: { in: customIds } } : undefined,
  ].filter(Boolean) as object[];
  return { ...(extra ?? {}), OR: or };
}

/**
 * For every holding, compare the current price to a snapshot taken at least
 * `daysBack` days ago (falls back to the oldest snapshot we have). Returns the
 * top gainers/losers, the full list, and aggregate totals.
 */
export async function computeMovers(daysBack = 7): Promise<{
  gainers: Mover[];
  losers: Mover[];
  all: Mover[];
  totalValue: number;
  totalChangeEur: number;
  totalChangePct: number;
}> {
  const holdings = await loadHoldings();
  if (holdings.length === 0) {
    return { gainers: [], losers: [], all: [], totalValue: 0, totalChangeEur: 0, totalChangePct: 0 };
  }

  const cardIds = holdings.filter((h) => !h.isCustom).map((h) => h.id);
  const customIds = holdings.filter((h) => h.isCustom).map((h) => h.id);
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const history = await prisma.priceHistory.findMany({
    where: historyWhere(cardIds, customIds),
    orderBy: { capturedAt: 'asc' },
  });

  // Reference snapshot per holding: latest ≤ since, else the oldest we have.
  const refByKey = new Map<string, (typeof history)[number]>();
  for (const h of history) {
    const key = h.cardId ? `card:${h.cardId}` : h.customCardId ? `custom:${h.customCardId}` : null;
    if (!key) continue;
    if (h.capturedAt <= since) refByKey.set(key, h);
    else if (!refByKey.has(key)) refByKey.set(key, h);
  }

  const all: Mover[] = [];
  let totalValue = 0;
  let totalChangeEur = 0;

  for (const h of holdings) {
    const currentEur = h.currentEur;
    if (currentEur <= 0) continue;
    const ref = refByKey.get(h.key);
    const previousEur = ref?.trendEur ?? ref?.avgEur ?? currentEur;
    const changeEur = currentEur - previousEur;
    const changePct = previousEur > 0 ? (changeEur / previousEur) * 100 : 0;
    const positionEur = currentEur * h.quantity;
    const positionChangeEur = changeEur * h.quantity;
    totalValue += positionEur;
    totalChangeEur += positionChangeEur;
    all.push({
      cardId: h.id,
      href: h.href,
      isCustom: h.isCustom,
      name: h.name,
      setName: h.setName,
      setCode: h.setCode,
      imageUrl: h.imageUrl,
      localId: h.localId,
      rarity: h.rarity,
      currentEur,
      previousEur,
      changeEur,
      changePct,
      quantity: h.quantity,
      positionEur,
      positionChangeEur,
    });
  }

  const moved = all.filter((m) => Math.abs(m.changeEur) > 0.005);
  const gainers = [...moved]
    .filter((m) => m.changeEur > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 5);
  const losers = [...moved]
    .filter((m) => m.changeEur < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 5);
  const allSorted = [...all].sort((a, b) => b.positionEur - a.positionEur);

  const previousTotal = totalValue - totalChangeEur;
  const totalChangePct = previousTotal > 0 ? (totalChangeEur / previousTotal) * 100 : 0;

  return { gainers, losers, all: allSorted, totalValue, totalChangeEur, totalChangePct };
}

export type PortfolioPoint = { capturedAt: string; value: number };

/**
 * Reconstruct a portfolio value curve from PriceHistory snapshots across both
 * Cards and CustomCards. For each snapshot day, sum (snapshot price × current
 * quantity) — i.e. "what would my current bag be worth at that point?".
 */
export async function computePortfolioCurve(days = 90): Promise<PortfolioPoint[]> {
  const holdings = await loadHoldings();
  if (holdings.length === 0) return [];

  const qtyByKey = new Map(holdings.map((h) => [h.key, h.quantity]));
  const cardIds = holdings.filter((h) => !h.isCustom).map((h) => h.id);
  const customIds = holdings.filter((h) => h.isCustom).map((h) => h.id);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const history = await prisma.priceHistory.findMany({
    where: historyWhere(cardIds, customIds, { capturedAt: { gte: since } }),
    orderBy: { capturedAt: 'asc' },
  });

  // Bucket snapshots per day (UTC) and per holding; keep the latest within day.
  type Bucket = Map<string, number>;
  const dayBuckets: Map<string, Bucket> = new Map();
  for (const h of history) {
    const key = h.cardId ? `card:${h.cardId}` : h.customCardId ? `custom:${h.customCardId}` : null;
    if (!key) continue;
    const day = h.capturedAt.toISOString().slice(0, 10);
    let bucket = dayBuckets.get(day);
    if (!bucket) {
      bucket = new Map();
      dayBuckets.set(day, bucket);
    }
    bucket.set(key, h.trendEur ?? h.avgEur ?? 0);
  }

  // Forward-fill missing prices across days using the last known value.
  const sortedDays = Array.from(dayBuckets.keys()).sort();
  const lastKnown = new Map<string, number>();
  const points: PortfolioPoint[] = [];
  for (const day of sortedDays) {
    const bucket = dayBuckets.get(day)!;
    for (const [key, price] of bucket) lastKnown.set(key, price);
    let total = 0;
    for (const [key, qty] of qtyByKey) {
      const price = lastKnown.get(key);
      if (price != null) total += price * qty;
    }
    points.push({ capturedAt: day, value: Math.round(total * 100) / 100 });
  }
  return points;
}
