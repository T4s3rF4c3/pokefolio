import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  coverColor: z.enum(['flame', 'water', 'electric', 'psychic', 'grass']).default('flame'),
  pageSize: z.coerce.number().int().min(1).max(20).default(9),
});

export async function GET() {
  const binders = await prisma.binder.findMany({
    include: { _count: { select: { slots: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(binders);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const binder = await prisma.binder.create({ data: parsed.data });
  return NextResponse.json(binder, { status: 201 });
}
