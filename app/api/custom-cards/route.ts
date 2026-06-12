import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { VARIANTS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  setId: z.string().optional().nullable(),
  setCodeLabel: z.string().max(40).optional().nullable(),
  setNameLabel: z.string().max(120).optional().nullable(),
  localId: z.string().min(1).max(40),
  name: z.string().min(1).max(160),
  rarity: z.string().max(60).optional().nullable(),
  category: z.string().max(40).optional().nullable(),
  variantHint: z.enum(VARIANTS).optional().nullable(),
  imageUrl: z
    .string()
    .refine((v) => v === '' || /^https?:\/\//.test(v) || v.startsWith('/uploads/'), {
      message: 'Bild-URL muss http(s) oder /uploads/… sein',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  cardmarketUrl: z
    .string()
    .url()
    .refine((u) => /cardmarket\./i.test(u), {
      message: 'Bitte eine Cardmarket-URL angeben',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  notes: z.string().max(800).optional().nullable(),
  manualPriceEur: z.coerce.number().nonnegative().optional().nullable(),
});

export async function GET() {
  const cards = await prisma.customCard.findMany({
    include: { set: { select: { name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(cards);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Try to link to a known set if setCodeLabel matches a synced set id.
  let setId = data.setId ?? null;
  if (!setId && data.setCodeLabel) {
    const candidate = await prisma.cardSet.findFirst({
      where: { OR: [{ id: data.setCodeLabel }, { code: data.setCodeLabel.toUpperCase() }] },
    });
    if (candidate) setId = candidate.id;
  }

  const card = await prisma.customCard.create({
    data: {
      setId,
      setCodeLabel: data.setCodeLabel || null,
      setNameLabel: data.setNameLabel || null,
      localId: data.localId,
      name: data.name,
      rarity: data.rarity || null,
      category: data.category || null,
      variantHint: data.variantHint || null,
      imageUrl: data.imageUrl || null,
      cardmarketUrl: data.cardmarketUrl || null,
      notes: data.notes || null,
      manualPriceEur: data.manualPriceEur ?? null,
      priceUpdatedAt: data.manualPriceEur != null ? new Date() : null,
    },
  });
  return NextResponse.json(card, { status: 201 });
}
