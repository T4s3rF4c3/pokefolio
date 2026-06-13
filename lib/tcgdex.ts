/**
 * Tiny TCGdex client.
 *
 * TCGdex exposes a REST API at https://api.tcgdex.net/v2/{lang}/...
 * We only use the bits we need: list sets, fetch a set with cards,
 * fetch a single card (which carries Cardmarket pricing in the response).
 */

const BASE = process.env.TCGDEX_BASE_URL ?? 'https://api.tcgdex.net/v2';
const DEFAULT_LANG = process.env.TCGDEX_LANG ?? 'de';

/**
 * Languages searched by name. TCGdex localizes card names per language, so a
 * German-only query never finds a card the user typed in English (e.g.
 * "Charizard" → German "Glurak"). We query the primary language plus English
 * and merge. Primary language wins on name; missing images are backfilled from
 * the other language. Override via TCGDEX_SEARCH_LANGS="de,en,fr".
 */
const SEARCH_LANGS = Array.from(
  new Set(
    (process.env.TCGDEX_SEARCH_LANGS ?? `${DEFAULT_LANG},en,ja`)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),
);

export type TcgdexSetSummary = {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: { total?: number; official?: number };
  releaseDate?: string;
  serie?: { id: string; name: string };
  abbreviation?: string | { official?: string; short?: string };
};

export type TcgdexCardSummary = {
  id: string;
  localId: string;
  name: string;
  image?: string;
};

export type TcgdexCardmarketPrice = {
  trend?: number;
  trendHolo?: number;
  avg?: number;
  avgHolo?: number;
  low?: number;
  lowHolo?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
  updated?: string;
};

type TcgPlayerVariant = {
  productId?: number;
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  marketPrice?: number;
  directLowPrice?: number;
};

export type TcgdexCardFull = {
  id: string;
  localId: string;
  name: string;
  image?: string;
  category?: string;
  hp?: number;
  types?: string[];
  rarity?: string;
  illustrator?: string;
  set?: { id: string; name: string };
  pricing?: {
    cardmarket?: {
      updated?: string;
      unit?: string;
      avg?: number;
      low?: number;
      trend?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
      'avg-holo'?: number;
      'low-holo'?: number;
      'trend-holo'?: number;
      [key: string]: unknown;
    };
    tcgplayer?: {
      updated?: string;
      unit?: string;
      normal?: TcgPlayerVariant;
      holofoil?: TcgPlayerVariant;
      'reverse-holofoil'?: TcgPlayerVariant;
      [key: string]: unknown;
    };
  };
};

async function tcgFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    // Server cache for 6h; sync route bypasses with no-store
    next: { revalidate: 60 * 60 * 6 },
  });
  if (!res.ok) {
    throw new Error(`TCGdex ${res.status} ${res.statusText} → ${url}`);
  }
  return res.json() as Promise<T>;
}

export function lang(l?: string) {
  return l ?? DEFAULT_LANG;
}

export function listSets(l?: string) {
  return tcgFetch<TcgdexSetSummary[]>(`/${lang(l)}/sets`);
}

export function getSet(setId: string, l?: string) {
  return tcgFetch<TcgdexSetSummary & { cards: TcgdexCardSummary[] }>(
    `/${lang(l)}/sets/${encodeURIComponent(setId)}`,
  );
}

export function getCard(cardId: string, l?: string) {
  return tcgFetch<TcgdexCardFull>(`/${lang(l)}/cards/${encodeURIComponent(cardId)}`);
}

/**
 * Fetch a card trying each SEARCH_LANGS language in order, returning the first
 * hit plus the language it was found under. Japanese-only cards (e.g.
 * "sv3-113", which 404s under de/en) resolve here under "ja".
 */
export async function getCardAnyLang(
  cardId: string,
): Promise<{ card: TcgdexCardFull; lang: string } | null> {
  for (const l of SEARCH_LANGS) {
    try {
      const card = await getCard(cardId, l);
      if (card?.id) return { card, lang: l };
    } catch {
      /* try next language */
    }
  }
  return null;
}

// Fuzzy search by name in a single language.
export function searchCards(query: string, l?: string) {
  const url = `/${lang(l)}/cards?name=like:${encodeURIComponent(query)}`;
  return tcgFetch<TcgdexCardSummary[]>(url);
}

/**
 * Fuzzy search by name across all SEARCH_LANGS in parallel, merged.
 *
 * Dedupes by card id, keeping the first language's localized name (primary
 * language wins because SEARCH_LANGS lists it first). If the kept entry has no
 * image but a duplicate from another language does, the image is backfilled —
 * TCGdex often omits images on localized search summaries.
 */
export async function searchCardsMultiLang(query: string): Promise<TcgdexCardSummary[]> {
  const results = await Promise.allSettled(SEARCH_LANGS.map((l) => searchCards(query, l)));
  const byId = new Map<string, TcgdexCardSummary>();
  for (const r of results) {
    if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
    for (const c of r.value) {
      if (!c?.id) continue;
      const existing = byId.get(c.id);
      if (!existing) {
        byId.set(c.id, c);
      } else if (!existing.image && c.image) {
        byId.set(c.id, { ...existing, image: c.image });
      }
    }
  }
  return Array.from(byId.values());
}

/**
 * TCGdex card image URL.
 * Base looks like https://assets.tcgdex.net/de/sv/sv03/001
 * Final:        https://assets.tcgdex.net/de/sv/sv03/001/high.webp
 */
export function cardImageUrl(
  image: string | undefined | null,
  quality: 'low' | 'high' = 'high',
) {
  if (!image) return null;
  return `${image}/${quality}.webp`;
}

/**
 * TCGdex set logo / symbol URL.
 * Base looks like https://assets.tcgdex.net/de/sv/sv03/logo
 * Final:        https://assets.tcgdex.net/de/sv/sv03/logo.png
 *
 * Set assets do NOT use a quality segment — just the extension.
 */
export function assetImageUrl(
  base: string | undefined | null,
  ext: 'png' | 'webp' | 'jpg' = 'png',
) {
  if (!base) return null;
  return `${base}.${ext}`;
}

// Backwards-compat shim (still card semantics).
export const imageUrl = cardImageUrl;

export function abbreviationOf(s: TcgdexSetSummary): string | null {
  const a = s.abbreviation;
  if (!a) return null;
  if (typeof a === 'string') return a.toUpperCase();
  return (a.official ?? a.short ?? null)?.toUpperCase() ?? null;
}

export type CardmarketPrices = {
  trendEur: number | null;
  avgEur: number | null;
  lowEur: number | null;
  trendHoloEur: number | null;
  avgHoloEur: number | null;
  updatedAt: Date;
};

const EMPTY_PRICES: CardmarketPrices = {
  trendEur: null,
  avgEur: null,
  lowEur: null,
  trendHoloEur: null,
  avgHoloEur: null,
  updatedAt: new Date(),
};

export type TcgplayerPrices = {
  variant: 'holofoil' | 'reverse-holofoil' | 'normal' | null;
  lowUsd: number | null;
  midUsd: number | null;
  highUsd: number | null;
  marketUsd: number | null;
  updatedAt: Date | null;
};

const EMPTY_TCGP: TcgplayerPrices = {
  variant: null,
  lowUsd: null,
  midUsd: null,
  highUsd: null,
  marketUsd: null,
  updatedAt: null,
};

/**
 * Extract a representative TCGplayer price band from a TCGdex card.
 *
 * Variant priority: holofoil → reverse-holofoil → normal. We pick the first
 * one that exists and use its low/mid/high/market USD values. The variant
 * label is persisted so the UI can call out which one we're showing.
 */
export function extractTcgplayerPrices(card: TcgdexCardFull): TcgplayerPrices {
  const tp = card.pricing?.tcgplayer;
  if (!tp) return { ...EMPTY_TCGP };
  const priority: Array<'holofoil' | 'reverse-holofoil' | 'normal'> = [
    'holofoil',
    'reverse-holofoil',
    'normal',
  ];
  for (const v of priority) {
    const block = tp[v];
    if (block && (block.marketPrice != null || block.lowPrice != null)) {
      return {
        variant: v,
        lowUsd: block.lowPrice ?? null,
        midUsd: block.midPrice ?? null,
        highUsd: block.highPrice ?? null,
        marketUsd: block.marketPrice ?? null,
        updatedAt: tp.updated ? new Date(tp.updated) : new Date(),
      };
    }
  }
  return { ...EMPTY_TCGP };
}

export function extractCardmarketPrices(card: TcgdexCardFull): CardmarketPrices {
  const cm = card.pricing?.cardmarket;
  if (!cm) return { ...EMPTY_PRICES };
  return {
    trendEur: typeof cm.trend === 'number' ? cm.trend : null,
    avgEur: typeof cm.avg === 'number' ? cm.avg : null,
    lowEur: typeof cm.low === 'number' ? cm.low : null,
    trendHoloEur: typeof cm['trend-holo'] === 'number' ? (cm['trend-holo'] as number) : null,
    avgHoloEur: typeof cm['avg-holo'] === 'number' ? (cm['avg-holo'] as number) : null,
    updatedAt: cm.updated ? new Date(cm.updated) : new Date(),
  };
}
