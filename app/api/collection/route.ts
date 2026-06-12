import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CONDITIONS, VARIANTS, LANGUAGES } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const addSchema = z
  .object({
    cardId: z.string().optional(),
    customCardId: z.string().optional(),
    quantity: z.coerce.number().int().min(1).max(999).default(1),
    condition: z.enum(CONDITIONS).default('NM'),
    variant: z.enum(VARIANTS).default('Normal'),
    language: z.enum(LANGUAGES).default('de'),
    purchasePrice: z.coerce.number().nullish(),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.cardId || v.customCardId, {
    message: 'cardId oder customCardId muss gesetzt sein',
  });

export async function GET() {
  const items = await prisma.collectionItem.findMany({
    include: {
      card: { include: { set: { select: { name: true, code: true } } } },
      customCard: { include: { set: { select: { name: true, code: true } } } },
    },
    orderBy: { acquiredAt: 'desc' },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = addSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const item = await prisma.collectionItem.create({
    data: {
      cardId: data.cardId ?? null,
      customCardId: data.customCardId ?? null,
      quantity: data.quantity,
      condition: data.condition,
      variant: data.variant,
      language: data.language,
      purchasePrice: data.purchasePrice ?? null,
      notes: data.notes ?? null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
