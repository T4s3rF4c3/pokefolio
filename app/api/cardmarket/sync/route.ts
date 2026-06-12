import { NextResponse } from 'next/server';
import { syncCardmarketCatalog } from '@/lib/cardmarket';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await syncCardmarketCatalog();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
