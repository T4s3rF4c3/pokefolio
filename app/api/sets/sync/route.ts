import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listSets, getSet, assetImageUrl, abbreviationOf } from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Two-pass sync:
 * 1. List endpoint → cheap stubs (id, name, cardCount, optional symbol).
 * 2. For each set, hit `/sets/{id}` to get logo, releaseDate, serie, abbreviation
 *    (printed code like "OBF"). Runs in parallel batches.
 */
export async function POST() {
  let stubs: Awaited<ReturnType<typeof listSets>> = [];
  try {
    stubs = await listSets();
  } catch (err) {
    return NextResponse.json(
      { error: 'TCGdex nicht erreichbar', details: String(err) },
      { status: 502 },
    );
  }

  // Pass 1 — upsert stubs immediately so the UI has something to show.
  for (const s of stubs) {
    await prisma.cardSet.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        cardCount: s.cardCount?.official ?? null,
        totalCount: s.cardCount?.total ?? null,
        symbolUrl: assetImageUrl(s.symbol),
      },
      update: {
        name: s.name,
        cardCount: s.cardCount?.official ?? null,
        totalCount: s.cardCount?.total ?? null,
        symbolUrl: assetImageUrl(s.symbol),
      },
    });
  }

  // Pass 2 — enrich with detail data. Batches of 8 in parallel.
  const BATCH = 8;
  let enriched = 0;
  let failed = 0;
  for (let i = 0; i < stubs.length; i += BATCH) {
    const slice = stubs.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (stub) => {
        try {
          const detail = await getSet(stub.id);
          await prisma.cardSet.update({
            where: { id: detail.id },
            data: {
              name: detail.name,
              series: detail.serie?.name ?? null,
              releaseDate: detail.releaseDate ? new Date(detail.releaseDate) : null,
              cardCount: detail.cardCount?.official ?? null,
              totalCount: detail.cardCount?.total ?? null,
              logoUrl: assetImageUrl(detail.logo),
              symbolUrl: assetImageUrl(detail.symbol),
              code: abbreviationOf(detail),
            },
          });
          enriched++;
        } catch {
          failed++;
        }
      }),
    );
  }

  await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, lastFullSync: new Date() },
    update: { lastFullSync: new Date() },
  });

  return NextResponse.json({
    total: stubs.length,
    enriched,
    failed,
  });
}
