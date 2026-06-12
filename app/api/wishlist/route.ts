import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const createSchema = z
  .object({
    cardId: z.string().optional(),
    customCardId: z.string().optional(),
    maxPriceEur: z.coerce.number().nonnegative().optional(),
    priority: z.coerce.number().int().min(0).max(3).default(0),
    notes: z.string().max(400).optional(),
  })
  .refine((v) => v.cardId || v.customCardId);

export async function GET() {
  const items = await prisma.wishlistItem.findMany({
    include: {
      card: { include: { set: { select: { name: true, code: true } } } },
      customCard: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await prisma.wishlistItem.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
