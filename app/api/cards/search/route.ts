import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  searchCards,
  cardImageUrl,
  getCard,
  extractCardmarketPrices,
  extractTcgplayerPrices,
} from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cards/search?q=charizard
 *
 * Resolves the query in multiple modes, in priority order:
 *   1. Code lookup: "OBF 205", "obf-205", "obf205" → setCode + localId.
 *      Hits CardSet.code or CardSet.id, then Card.localId. Also tries
 *      a direct TCGdex fetch like `<setId>-<padded localId>`.
 *   2. Text search: name LIKE + custom card LIKE.
 *   3. TCGdex broad search as a fallback.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ cards: [], customCards: [], remote: [], codeMatch: null });

  const codeMatch = await tryCodeLookup(q);

  const [cards, customCards] = await Promise.all([
    prisma.card.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { id: { contains: q.toLowerCase() } },
        ],
      },
      include: { set: { select: { name: true, code: true } } },
      take: 60,
      orderBy: { name: 'asc' },
    }),
    prisma.customCard.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { localId: { contains: q } },
          { setCodeLabel: { contains: q } },
        ],
      },
      take: 30,
      orderBy: { name: 'asc' },
    }),
  ]);

  let remote: { id: string; name: string; localId: string; imageUrl: string | null }[] = [];
  if (cards.length < 10 && !codeMatch) {
    try {
      const r = await searchCards(q);
      remote = r.slice(0, 30).map((c) => ({
        id: c.id,
        name: c.name,
        localId: c.localId,
        imageUrl: cardImageUrl(c.image, 'low'),
      }));
    } catch {
      remote = [];
    }
  }

  return NextResponse.json({ cards, customCards, remote, codeMatch });
}

/**
 * Parse and resolve a "set-code + number" pattern.
 * Accepts: "OBF 205", "obf-205", "obf205", "OBF205", "sv03 12", "PAF 091"
 */
async function tryCodeLookup(q: string) {
  const cleaned = q.trim().toUpperCase();
  // Patterns: "ABC 123", "ABC-123", "ABC123"
  const m = cleaned.match(/^([A-Z0-9]{2,6})[\s\-_/]*?(\d{1,4}[A-Z]?)$/);
  if (!m) return null;
  const [, codeRaw, numRaw] = m;
  const code = codeRaw.toUpperCase();
  const num = numRaw.toUpperCase();

  // Look up the set by printed code, by lowercase id, or by id-substring match.
  const set = await prisma.cardSet.findFirst({
    where: {
      OR: [{ code: code }, { id: code.toLowerCase() }, { id: { contains: code.toLowerCase() } }],
    },
  });

  let candidate = null as Awaited<ReturnType<typeof prisma.card.findFirst>> | null;
  if (set) {
    // Try several localId formats (203 vs 003 vs 03)
    const localIdVariants = Array.from(
      new Set([num, num.replace(/^0+/, ''), num.padStart(3, '0'), num.padStart(2, '0')]),
    );
    candidate = await prisma.card.findFirst({
      where: { setId: set.id, localId: { in: localIdVariants } },
      include: { set: true },
    });
  }

  if (!candidate) {
    // Final attempt: ask TCGdex directly. Try a couple of id shapes.
    const tcgdexCandidates = [
      set ? `${set.id}-${num}` : null,
      set ? `${set.id}-${num.padStart(3, '0')}` : null,
      `${code.toLowerCase()}-${num}`,
      `${code.toLowerCase()}-${num.padStart(3, '0')}`,
    ].filter(Boolean) as string[];

    for (const candId of tcgdexCandidates) {
      try {
        const remote = await getCard(candId);
        if (!remote?.id) continue;
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
        const upserted = await prisma.card.upsert({
          where: { id: remote.id },
          create: {
            id: remote.id,
            setId: remote.set?.id ?? candId.split('-')[0],
            localId: remote.localId,
            name: remote.name,
            rarity: remote.rarity ?? null,
            category: remote.category ?? null,
            hp: typeof remote.hp === 'number' ? remote.hp : null,
            types: remote.types?.join(',') ?? null,
            imageUrl: cardImageUrl(remote.image, 'high'),
            imageUrlSmall: cardImageUrl(remote.image, 'low'),
            priceTrendEur: prices.trendEur,
            priceAvgEur: prices.avgEur,
            priceLowEur: prices.lowEur,
            priceTrendHoloEur: prices.trendHoloEur,
            priceAvgHoloEur: prices.avgHoloEur,
            priceUpdatedAt: prices.updatedAt,
            ...tcgpData,
            lang: 'de',
          },
          update: {
            name: remote.name,
            imageUrl: cardImageUrl(remote.image, 'high'),
            imageUrlSmall: cardImageUrl(remote.image, 'low'),
            priceTrendEur: prices.trendEur,
            priceAvgEur: prices.avgEur,
            priceLowEur: prices.lowEur,
            priceTrendHoloEur: prices.trendHoloEur,
            priceAvgHoloEur: prices.avgHoloEur,
            priceUpdatedAt: prices.updatedAt,
            ...tcgpData,
          },
          include: { set: true },
        });
        return upserted;
      } catch {
        /* try next candidate */
      }
    }
  }

  return candidate;
}
