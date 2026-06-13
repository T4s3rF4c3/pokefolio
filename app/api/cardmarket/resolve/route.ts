import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCardmarketProduct } from '@/lib/cardmarket';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  input: z.string().min(1),
});

/**
 * POST /api/cardmarket/resolve — turn a pasted Cardmarket reference (product
 * image URL, idProduct number, or product-page URL) into a synced bulk price
 * + idProduct linkage. Reads only the local Cardmarket tables; no scraping.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'input fehlt' }, { status: 400 });
  }
  const result = await resolveCardmarketProduct(parsed.data.input);
  return NextResponse.json(result);
}
