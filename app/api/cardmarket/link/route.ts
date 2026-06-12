import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z
  .object({
    cardId: z.string().optional(),
    customCardId: z.string().optional(),
    idProduct: z.union([z.number().int().positive(), z.null()]),
  })
  .refine((v) => !!(v.cardId || v.customCardId), {
    message: 'cardId oder customCardId nötig',
  });

/**
 * POST /api/cardmarket/link — point a Card or CustomCard at a Cardmarket
 * product. Pass idProduct=null to clear the linkage.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cardId, customCardId, idProduct } = parsed.data;

  if (cardId) {
    const card = await prisma.card.update({
      where: { id: cardId },
      data: { cardmarketIdProduct: idProduct },
    });
    return NextResponse.json({ ok: true, card });
  }
  if (customCardId) {
    const card = await prisma.customCard.update({
      where: { id: customCardId },
      data: { cardmarketIdProduct: idProduct },
    });
    return NextResponse.json({ ok: true, customCard: card });
  }
  return NextResponse.json({ error: 'unreachable' }, { status: 500 });
}
