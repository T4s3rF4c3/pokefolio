import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CONDITIONS, VARIANTS, LANGUAGES } from '@/lib/utils';

const updateSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  condition: z.enum(CONDITIONS).optional(),
  variant: z.enum(VARIANTS).optional(),
  language: z.enum(LANGUAGES).optional(),
  purchasePrice: z.coerce.number().nullish(),
  notes: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const json = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const item = await prisma.collectionItem.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  // deleteMany is idempotent: a no-op (count 0) if the row is already gone,
  // so a double-click never surfaces a 500 (P2025).
  const { count } = await prisma.collectionItem.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true, deleted: count });
}
