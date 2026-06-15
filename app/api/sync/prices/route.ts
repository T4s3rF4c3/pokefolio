import { NextResponse } from 'next/server';
import { runPriceSync } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/sync/prices — refresh prices and append a price-history point for
 * every Card AND CustomCard referenced by the collection or wishlist.
 *
 * The actual work lives in lib/sync's runPriceSync so the in-process scheduler
 * (instrumentation.ts) can reuse it without going through HTTP.
 */
export async function POST() {
  const result = await runPriceSync();
  return NextResponse.json(result);
}
