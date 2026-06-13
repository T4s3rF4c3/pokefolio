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

// ---------------------------------------------------------------------------
// Automatic price import from a pasted Cardmarket reference.
//
// Cardmarket's product page is Cloudflare-gated, but two other surfaces are
// not: the S3 product-image CDN (whose URL embeds the idProduct) and the bulk
// price guide we already sync into CardmarketPrice. So instead of scraping the
// page, we pull the idProduct out of whatever the user pastes and look the
// price up locally. Mirrors the approach from the previous app version.
// ---------------------------------------------------------------------------

export type ParsedCardmarketInput =
  | { source: 'image-url'; idProduct: number; setCode: string | null }
  | { source: 'id'; idProduct: number; setCode: null }
  | {
      source: 'page-url';
      idProduct: number | null;
      setCode: string | null;
      cardNumber: string | null;
      cardName: string | null;
      setName: string | null;
    }
  | null;

/**
 * Pull an idProduct (and, when available, set code / name) out of any
 * Cardmarket-related input:
 *   1. Product image URL:  https://product-images.s3.cardmarket.com/51/MEW/769543/769543.jpg
 *   2. Plain idProduct:    769543
 *   3. Product page URL:   …/Singles/Pokemon-Card-151/Mewtwo-V2-sv2a183  (idProduct only
 *      if the URL carries a ?idProduct= query; otherwise name/set are parsed)
 */
export function parseCardmarketInput(input: string): ParsedCardmarketInput {
  const s = (input ?? '').trim();
  if (!s) return null;

  // 1. S3 image CDN URL — most reliable, contains idProduct directly.
  const imgMatch = s.match(/product-images\.s3\.cardmarket\.com\/51\/([^/]+)\/(\d+)\//i);
  if (imgMatch) {
    return { source: 'image-url', setCode: imgMatch[1].toUpperCase(), idProduct: parseInt(imgMatch[2], 10) };
  }

  // 2. Plain idProduct number.
  if (/^\d{4,8}$/.test(s)) {
    return { source: 'id', setCode: null, idProduct: parseInt(s, 10) };
  }

  // 3. Cardmarket product page URL.
  if (/cardmarket\./i.test(s)) {
    try {
      const u = new URL(s);
      const qId = u.searchParams.get('idProduct');
      if (qId && /^\d+$/.test(qId)) {
        return { source: 'id', setCode: null, idProduct: parseInt(qId, 10) };
      }
      const parts = u.pathname.split('/').filter(Boolean);
      const singlesIdx = parts.findIndex((p) => p === 'Singles');
      if (singlesIdx !== -1 && singlesIdx + 2 < parts.length) {
        const setSlug = parts[singlesIdx + 1];
        const cardSlug = parts[singlesIdx + 2];
        const m = cardSlug.match(/[^-]*-([A-Za-z][A-Za-z0-9]*?[A-Za-z])(\d{1,4})$/);
        return {
          source: 'page-url',
          idProduct: null,
          setCode: m ? m[1].toUpperCase() : null,
          cardNumber: m ? m[2] : null,
          cardName: m
            ? cardSlug.slice(0, cardSlug.lastIndexOf('-' + m[1] + m[2])).replace(/-/g, ' ')
            : decodeURIComponent(cardSlug).replace(/-/g, ' '),
          setName: decodeURIComponent(setSlug).replace(/-/g, ' '),
        };
      }
    } catch {
      /* not a parseable URL */
    }
  }

  return null;
}

/** Deterministic S3 product-image URL (no fetch, no auth). */
export function cardmarketImageUrl(setCode: string, idProduct: number): string {
  return `https://product-images.s3.cardmarket.com/51/${setCode.toUpperCase()}/${idProduct}/${idProduct}.jpg`;
}

export type ResolveCardmarketResult =
  | {
      found: true;
      idProduct: number;
      name: string;
      setCode: string | null;
      imageUrl: string | null;
      productUrl: string;
      priceEur: number | null;
      price: CardmarketPriceRow;
    }
  | {
      found: false;
      idProduct: number | null;
      // Best-effort fields parsed from a page URL so the form can still prefill.
      setCode: string | null;
      cardName: string | null;
      cardNumber: string | null;
      setName: string | null;
      reason: string;
    };

/**
 * Resolve a pasted Cardmarket reference to a synced product + bulk price.
 * Reads only the local Cardmarket tables — run the bulk sync first.
 */
export async function resolveCardmarketProduct(input: string): Promise<ResolveCardmarketResult> {
  const parsed = parseCardmarketInput(input);
  if (!parsed) {
    return {
      found: false,
      idProduct: null,
      setCode: null,
      cardName: null,
      cardNumber: null,
      setName: null,
      reason:
        'Eingabe nicht erkannt. Bitte eine Cardmarket-Bild-URL, eine idProduct-Nummer oder eine Produktseiten-URL einfügen.',
    };
  }

  // Page URL without an idProduct: hand back the parsed name/set for prefill.
  if (parsed.source === 'page-url' && parsed.idProduct == null) {
    return {
      found: false,
      idProduct: null,
      setCode: parsed.setCode,
      cardName: parsed.cardName,
      cardNumber: parsed.cardNumber,
      setName: parsed.setName,
      reason:
        'Name und Set aus der URL übernommen, aber ohne idProduct kein automatischer Preis. Tipp: Rechtsklick auf das Kartenbild auf Cardmarket → Bildadresse kopieren und hier einfügen.',
    };
  }

  const idProduct = parsed.idProduct as number;
  const setCode = 'setCode' in parsed ? parsed.setCode : null;

  const product = await prisma.cardmarketProduct.findUnique({
    where: { idProduct },
    include: { price: true },
  });

  if (!product) {
    return {
      found: false,
      idProduct,
      setCode,
      cardName: null,
      cardNumber: null,
      setName: null,
      reason:
        'idProduct erkannt, aber nicht in den lokalen Bulk-Daten. Bitte zuerst unter „Einstellungen → Cardmarket Bulk-Daten holen" synchronisieren.',
    };
  }

  const p = product.price;
  const price: CardmarketPriceRow = {
    avg: p?.avg ?? null,
    low: p?.low ?? null,
    trend: p?.trend ?? null,
    avg1: p?.avg1 ?? null,
    avg7: p?.avg7 ?? null,
    avg30: p?.avg30 ?? null,
    avgHolo: p?.avgHolo ?? null,
    lowHolo: p?.lowHolo ?? null,
    trendHolo: p?.trendHolo ?? null,
  };
  const priceEur = price.trend ?? price.avg ?? price.low ?? null;

  return {
    found: true,
    idProduct,
    name: product.name,
    setCode,
    imageUrl: setCode ? cardmarketImageUrl(setCode, idProduct) : null,
    // Canonical product-page link (redirects to the right page). Stored as the
    // card's cardmarketUrl so the detail-view link works even when the user
    // pasted an image URL or a bare idProduct.
    productUrl: `https://www.cardmarket.com/de/Pokemon/Products?idProduct=${idProduct}`,
    priceEur,
    price,
  };
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
