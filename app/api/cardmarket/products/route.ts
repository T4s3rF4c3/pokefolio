import { NextResponse } from 'next/server';
import { searchProducts } from '@/lib/cardmarket';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const products = await searchProducts(q, 30);
  return NextResponse.json(products);
}
