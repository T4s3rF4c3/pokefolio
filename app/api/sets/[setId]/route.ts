import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSet, cardImageUrl, assetImageUrl, abbreviationOf } from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';

// GET /api/sets/{setId}
// Returns local DB set + cards. If the set hasn't been deeply synced yet,
// we fetch it from TCGdex on-demand and persist its card list.
export async function GET(_req: Request, { params }: { params: { setId: string } }) {
  const setId = params.setId;

  let cardSet = await prisma.cardSet.findUnique({
    where: { id: setId },
    include: { cards: { orderBy: { localId: 'asc' } } },
  });

  if (!cardSet || cardSet.cards.length === 0) {
    try {
      const remote = await getSet(setId);
      await prisma.cardSet.upsert({
        where: { id: setId },
        create: {
          id: remote.id,
          name: remote.name,
          code: abbreviationOf(remote),
          series: remote.serie?.name ?? null,
          releaseDate: remote.releaseDate ? new Date(remote.releaseDate) : null,
          cardCount: remote.cardCount?.official ?? null,
          totalCount: remote.cardCount?.total ?? null,
          logoUrl: assetImageUrl(remote.logo),
          symbolUrl: assetImageUrl(remote.symbol),
        },
        update: {
          name: remote.name,
          code: abbreviationOf(remote),
          series: remote.serie?.name ?? null,
          releaseDate: remote.releaseDate ? new Date(remote.releaseDate) : null,
          cardCount: remote.cardCount?.official ?? null,
          totalCount: remote.cardCount?.total ?? null,
          logoUrl: assetImageUrl(remote.logo),
          symbolUrl: assetImageUrl(remote.symbol),
        },
      });

      for (const c of remote.cards) {
        await prisma.card.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            setId: remote.id,
            localId: c.localId,
            name: c.name,
            imageUrl: cardImageUrl(c.image, 'high'),
            imageUrlSmall: cardImageUrl(c.image, 'low'),
            lang: 'de',
          },
          update: {
            name: c.name,
            imageUrl: cardImageUrl(c.image, 'high'),
            imageUrlSmall: cardImageUrl(c.image, 'low'),
          },
        });
      }

      cardSet = await prisma.cardSet.findUnique({
        where: { id: setId },
        include: { cards: { orderBy: { localId: 'asc' } } },
      });
    } catch (err) {
      return NextResponse.json(
        { error: 'Set kann nicht geladen werden', details: String(err) },
        { status: 502 },
      );
    }
  }

  const customCards = await prisma.customCard.findMany({
    where: { OR: [{ setId }, { setCodeLabel: setId }] },
    orderBy: { localId: 'asc' },
  });

  return NextResponse.json({ set: cardSet, customCards });
}
