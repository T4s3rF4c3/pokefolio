import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { VARIANTS } from '@/lib/utils';

const updateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  localId: z.string().min(1).max(40).optional(),
  setCodeLabel: z.string().max(40).optional().nullable(),
  setNameLabel: z.string().max(120).optional().nullable(),
  setId: z.string().optional().nullable(),
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
  cardmarketUrl: z.string().url().optional().nullable().or(z.literal('')),
  notes: z.string().max(800).optional().nullable(),
  manualPriceEur: z.coerce.number().nonnegative().optional().nullable(),
  cardmarketIdProduct: z.coerce.number().int().positive().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const json = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const card = await prisma.customCard.update({
    where: { id: params.id },
    data: {
      ...data,
      imageUrl: data.imageUrl === '' ? null : data.imageUrl,
      cardmarketUrl: data.cardmarketUrl === '' ? null : data.cardmarketUrl,
      priceUpdatedAt:
        data.manualPriceEur != null ? new Date() : undefined,
    },
  });
  return NextResponse.json(card);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.customCard.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
