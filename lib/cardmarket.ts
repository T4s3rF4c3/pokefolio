/**
 * Cardmarket bulk catalog & price-guide integration.
 *
 * Cardmarket publishes daily public JSON drops for product catalogs and
 * price guides at:
 *
 *   https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json
 *   https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json
 *
 * Game id 6 = Pokémon TCG. These files are public (no API key, no Cloudflare
 * gate — served directly from S3). We import them into the local SQLite so
 * every linked card has up-to-date prices without per-request scraping.
 */

import { prisma } from '@/lib/prisma';

const URL_PRODUCTS =
  'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json';
const URL_PRICES =
  'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json';

// We only care about Pokémon Single (idCategory 51). The price guide does
// include other categories (sealed, structure decks, ...) and we drop them.
const CATEGORY_SINGLE = 51;

type RawProduct = {
  idProduct: number;
  name: string;
  idCategory: number;
  categoryName?: string;
  idExpansion: number;
  idMetacard?: number;
  dateAdded?: string;
};

type RawPrice = {
  idProduct: number;
  idCategory: number;
  avg?: number | null;
  low?: number | null;
  trend?: number | null;
  avg1?: number | null;
  avg7?: number | null;
  avg30?: number | null;
  'avg-holo'?: number | null;
  'low-holo'?: number | null;
  'trend-holo'?: number | null;
};

/**
 * Strip Cardmarket's attack-list bracket suffix so "Charizard ex [Burning
 * Darkness | Explosive Vortex]" becomes "charizard ex" — much friendlier
 * for fuzzy match against TCGdex card names.
 */
export function makeSearchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type CardmarketPriceRow = {
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  avgHolo: number | null;
  lowHolo: number | null;
  trendHolo: number | null;
};

export type SyncResult = {
  products: number;
  prices: number;
  durationMs: number;
  catalogAt: string;
  pricesAt: string;
};

/**
 * Pull both bulk files and replace the local Cardmarket tables.
 * Uses transactions in chunks so the entire 70k import stays atomic per chunk.
 */
export async function syncCardmarketCatalog(): Promise<SyncResult> {
  const startedAt = Date.now();

  // Fetch with no Next cache — these files change daily and we want fresh data
  // whenever the user clicks "sync".
  const [productsRes, pricesRes] = await Promise.all([
    fetch(URL_PRODUCTS, { cache: 'no-store' }),
    fetch(URL_PRICES, { cache: 'no-store' }),
  ]);
  if (!productsRes.ok) throw new Error(`Catalog fetch ${productsRes.status}`);
  if (!pricesRes.ok) throw new Error(`Prices fetch ${pricesRes.status}`);

  const catalog = (await productsRes.json()) as {
    products: RawProduct[];
    createdAt?: string;
  };
  const prices = (await pricesRes.json()) as {
    priceGuides: RawPrice[];
    createdAt?: string;
  };

  const singles = catalog.products.filter((p) => p.idCategory === CATEGORY_SINGLE);
  const priceRows = prices.priceGuides.filter((p) => p.idCategory === CATEGORY_SINGLE);

  // Wipe the existing rows so deleted products don't linger. Cascade clears prices.
  await prisma.cardmarketProduct.deleteMany({});

  const CHUNK = 1000;

  for (let i = 0; i < singles.length; i += CHUNK) {
    const slice = singles.slice(i, i + CHUNK);
    await prisma.cardmarketProduct.createMany({
      data: slice.map((p) => ({
        idProduct: p.idProduct,
        name: p.name,
        idExpansion: p.idExpansion,
        idMetacard: p.idMetacard ?? null,
        dateAdded: p.dateAdded ?? null,
        searchKey: makeSearchKey(p.name),
      })),
    });
  }

  // Build a Set of valid idProducts so we don't insert orphaned prices.
  const validIds = new Set(singles.map((p) => p.idProduct));
  const filteredPrices = priceRows.filter((p) => validIds.has(p.idProduct));

  const capturedAt = new Date();
  for (let i = 0; i < filteredPrices.length; i += CHUNK) {
    const slice = filteredPrices.slice(i, i + CHUNK);
    await prisma.cardmarketPrice.createMany({
      data: slice.map((p) => ({
        idProduct: p.idProduct,
        avg: p.avg ?? null,
        low: p.low ?? null,
        trend: p.trend ?? null,
        avg1: p.avg1 ?? null,
        avg7: p.avg7 ?? null,
        avg30: p.avg30 ?? null,
        avgHolo: p['avg-holo'] ?? null,
        lowHolo: p['low-holo'] ?? null,
        trendHolo: p['trend-holo'] ?? null,
        capturedAt,
      })),
    });
  }

  const result: SyncResult = {
    products: singles.length,
    prices: filteredPrices.length,
    durationMs: Date.now() - startedAt,
    catalogAt: catalog.createdAt ?? new Date().toISOString(),
    pricesAt: prices.createdAt ?? new Date().toISOString(),
  };

  await prisma.cardmarketSync.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      productsCount: result.products,
      pricesCount: result.prices,
      catalogAt: new Date(result.catalogAt),
      pricesAt: new Date(result.pricesAt),
      syncedAt: new Date(),
    },
    update: {
      productsCount: result.products,
      pricesCount: result.prices,
      catalogAt: new Date(result.catalogAt),
      pricesAt: new Date(result.pricesAt),
      syncedAt: new Date(),
    },
  });

  return result;
}

/**
 * Fuzzy product lookup by name. Used by the picker UI.
 */
export async function searchProducts(q: string, limit = 25) {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const key = makeSearchKey(trimmed);
  return prisma.cardmarketProduct.findMany({
    where: {
      OR: [
        { searchKey: { contains: key } },
        { name: { contains: trimmed } },
        { idProduct: Number.isFinite(Number(trimmed)) ? Number(trimmed) : -1 },
      ],
    },
    include: { price: true },
    take: limit,
    orderBy: [{ searchKey: 'asc' }, { idProduct: 'asc' }],
  });
}
