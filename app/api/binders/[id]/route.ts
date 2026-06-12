import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const slotSchema = z.object({
  position: z.coerce.number().int().min(0).max(5000),
  cardId: z.string().optional().nullable(),
  customCardId: z.string().optional().nullable(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const binder = await prisma.binder.findUnique({
    where: { id: params.id },
    include: {
      slots: {
        orderBy: { position: 'asc' },
        include: {
          card: true,
          customCard: true,
        },
      },
    },
  });
  if (!binder) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json(binder);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const json = await req.json().catch(() => ({}));
  const parsed = slotSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const slot = await prisma.binderSlot.upsert({
    where: {
      binderId_position: { binderId: params.id, position: parsed.data.position },
    },
    create: {
      binderId: params.id,
      position: parsed.data.position,
      cardId: parsed.data.cardId ?? null,
      customCardId: parsed.data.customCardId ?? null,
    },
    update: {
      cardId: parsed.data.cardId ?? null,
      customCardId: parsed.data.customCardId ?? null,
    },
  });
  return NextResponse.json(slot);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.binder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
