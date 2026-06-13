import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sets = await prisma.cardSet.findMany({
    orderBy: { releaseDate: 'desc' },
    include: { _count: { select: { cards: true, customCards: true } } },
  });
  return NextResponse.json(sets);
}
