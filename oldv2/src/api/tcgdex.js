import { findManualByAbbr, findManualByName, getManualCard } from '../data/manualCards';
import { searchPtcgIo, getPtcgIoCard } from './pokemontcg';

// Preis-Logik liegt in shared/pricing.js (auch vom Server-Cron genutzt)
export { extractPrices, getPrimaryPrice, priceForEntry, entryVariant, entryKey } from '../../shared/pricing.js';

const BASE = 'https://api.tcgdex.net/v2';

// All languages to search across for card queries
const SEARCH_LANGS = ['de', 'en', 'fr', 'es', 'it', 'pt', 'ja', 'zh-tw', 'zh-cn', 'ko'];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API-Fehler ${res.status}`);
  return res.json();
}

export function cardImageSmall(imageBase) {
  return imageBase ? `${imageBase}/low.webp` : null;
}
export function cardImageLarge(imageBase) {
  return imageBase ? `${imageBase}/high.webp` : null;
}

// ---------------------------------------------------------------------------
// Query parser – detects three input formats:
//   1. TCGdex direct ID:   "sv1-1", "xy3-45", "swsh1-10" etc.
//   2. Abbr + number:      "ASC 269", "ASC269", "SVE 5", "MEW001"
//   3. Plain name search:  "Pikachu", "Charizard ex"
// ---------------------------------------------------------------------------
export function parseQuery(raw) {
  const q = raw.trim();

  // Format 1: direct TCGdex card ID — letters+optional-digits DASH digits, no space
  // e.g. "sv1-1", "swsh12-185", "xy3-45"
  if (/^[a-zA-Z]{1,6}\d{0,3}-\d+$/.test(q)) {
    return { type: 'tcgdex-id', id: q };
  }

  // Format 2a: abbreviation + space + number
  // Abbreviation starts with a letter, may contain digits anywhere (e.g. CBB3C, M2A, SWSH12)
  // e.g. "ASC 269", "SWSH12 185", "MEW 001", "CBB3C 03", "M2A 232"
  const mSpace = q.match(/^([A-Za-z][A-Za-z0-9]{1,7})\s+(\d{1,4})$/);
  if (mSpace) {
    return { type: 'abbr-number', abbr: mSpace[1].toUpperCase(), number: mSpace[2] };
  }

  // Format 2b: abbreviation + number (no space), abbreviation must end with a letter.
  // Lazy match so the shortest abbr ending in a letter is preferred, leaving the
  // trailing digit sequence as the card number.
  // e.g. "ASC269" → ASC+269, "CBB3C03" → CBB3C+03, "M2A232" → M2A+232
  const mNoSpace = q.match(/^([A-Za-z][A-Za-z0-9]*?[A-Za-z])(\d{1,4})$/);
  if (mNoSpace) {
    return { type: 'abbr-number', abbr: mNoSpace[1].toUpperCase(), number: mNoSpace[2] };
  }

  return { type: 'name', query: q };
}

// How well does a set (brief data from /sets) match an abbreviation?
// Returns 0 (no match) – 3 (strong match)
function setMatchScore(set, abbr) {
  const id   = (set.id   ?? '').toLowerCase();
  const name = (set.name ?? '').toLowerCase();
  const a    = abbr.toLowerCase();

  if (id === a) return 3;
  if (id.startsWith(a)) return 2;
  // "ASC" → "Ascended Heroes" – name starts with abbr
  if (name.replace(/\s/g, '').startsWith(a)) return 2;
  if (name.startsWith(a)) return 2;
  // Acronym: first letter of each word spells the abbreviation
  const acronym = name.split(/\s+/).map(w => w[0] ?? '').join('');
  if (acronym === a) return 2;
  // Partial: name contains abbr as a word prefix
  if (name.split(/\s+/).some(w => w.startsWith(a))) return 1;
  return 0;
}

function normalizeCard(c, lang) {
  return { ...c, imageSmall: cardImageSmall(c.image), imageLarge: cardImageLarge(c.image), _lang: lang };
}

// ---------------------------------------------------------------------------
// Core search: plain name query (as before)
// ---------------------------------------------------------------------------
export async function searchCards(query, lang = 'de') {
  const params = new URLSearchParams({ name: query });
  const data = await get(`${BASE}/${lang}/cards?${params}`);
  if (!Array.isArray(data)) return [];
  return data.map(c => normalizeCard(c, lang));
}

// ---------------------------------------------------------------------------
// Search by card number (localId) across all sets for a given language.
// Then ranks results by how well their set matches the abbreviation.
// ---------------------------------------------------------------------------
async function searchByLocalId(number, lang) {
  try {
    const params = new URLSearchParams({ localId: number });
    const data = await get(`${BASE}/${lang}/cards?${params}`);
    if (!Array.isArray(data)) return [];
    // TCGdex does substring matching — filter to exact number matches only
    return data
      .filter(c => numbersMatch(localIdFromCardId(c.id), number))
      .map(c => normalizeCard(c, lang));
  } catch {
    return [];
  }
}

// Extract the TCGdex set ID from a card ID like "me03-121" → "me03"
function setIdFromCardId(cardId) {
  if (!cardId) return null;
  const idx = cardId.lastIndexOf('-');
  return idx > 0 ? cardId.slice(0, idx) : null;
}

// Extract the localId from a card ID like "me03-121" → "121", "me04-001" → "001"
function localIdFromCardId(cardId) {
  if (!cardId) return null;
  const idx = cardId.lastIndexOf('-');
  return idx >= 0 ? cardId.slice(idx + 1) : null;
}

// TCGdex localId search does substring matching (localId=1 also returns 10, 11…).
// Compare numerically to get an exact match: "001" == "1", "121" == "121".
function numbersMatch(a, b) {
  const ia = parseInt(a, 10), ib = parseInt(b, 10);
  return (!isNaN(ia) && !isNaN(ib) && ia === ib) || a === b;
}

// ---------------------------------------------------------------------------
// Abbr + number search (three passes):
//
//  Pass 1 – heuristic: set name / set-id starts with abbr (fast, no extra calls)
//  Pass 2 – official abbreviation: fetch set details only for the sets that
//            actually contain a card with this localId (extracted from card IDs)
//  Pass 3 – fallback: return all cards with that localId so the user can pick
// ---------------------------------------------------------------------------
async function searchAbbrNumber(abbr, number, lang) {
  const byId = await searchByLocalId(number, lang);

  // Pass 1: heuristic match on set name / id embedded in card ID
  // Card IDs follow "{setId}-{localId}", so we can parse the set ID directly.
  const heuristic = byId
    .map(c => {
      const derivedSetId = setIdFromCardId(c.id);
      const pseudo = { id: derivedSetId ?? '', name: derivedSetId ?? '' };
      return { card: c, score: setMatchScore(pseudo, abbr) };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (heuristic.length > 0) return heuristic.map(x => x.card);

  // Pass 2: extract unique set IDs from card IDs, fetch their details in
  //         parallel and check abbreviation.official against the user's abbr.
  //         This handles cases where Cardmarket abbreviation (e.g. "POR") differs
  //         from the set name ("Optimale Ordnung") and set ID ("me03").
  const uniqueSetIds = [...new Set(byId.map(c => setIdFromCardId(c.id)).filter(Boolean))];
  if (uniqueSetIds.length > 0) {
    const details = await Promise.allSettled(
      uniqueSetIds.map(sid => getSetDetail(sid, lang))
    );
    for (let i = 0; i < details.length; i++) {
      if (details[i].status !== 'fulfilled') continue;
      const detail = details[i].value;
      const official = (detail?.abbreviation?.official ?? '').toUpperCase();
      if (official === abbr) {
        // Found via official abbreviation — return just the matching card(s)
        const matchingSid = uniqueSetIds[i];
        return byId.filter(c => setIdFromCardId(c.id) === matchingSid);
      }
    }
  }

  // No set match found — return empty rather than flooding with unrelated cards
  return [];
}

// ---------------------------------------------------------------------------
// Main entry point – searches all supported languages simultaneously.
// Deduplicates by id+lang so the same card appears once per language variant.
// Returns { cards, queryType } so callers can show contextual error messages.
// ---------------------------------------------------------------------------
export async function searchCardsMultiLang(query) {
  const parsed = parseQuery(query);

  // Deduplicate by card ID only — one result per card, preferred language first
  // (SEARCH_LANGS order determines priority: de → en → fr → ...)
  const dedup = (cards) => {
    const seen = new Set();
    return cards.filter(c => {
      const k = c.id ?? '';
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  // Direct TCGdex ID: fetch all language versions in parallel
  if (parsed.type === 'tcgdex-id') {
    const results = await Promise.allSettled(
      SEARCH_LANGS.map(l =>
        get(`${BASE}/${l}/cards/${parsed.id}`).then(c => normalizeCard(c, l))
      )
    );
    return { cards: dedup(results.filter(r => r.status === 'fulfilled').map(r => r.value)), queryType: 'tcgdex-id' };
  }

  // Abbreviation + number: search all languages, then fall back to manual DB
  if (parsed.type === 'abbr-number') {
    const results = await Promise.allSettled(
      SEARCH_LANGS.map(l => searchAbbrNumber(parsed.abbr, parsed.number, l))
    );
    const tcgCards = dedup(results.filter(r => r.status === 'fulfilled').flatMap(r => r.value));
    const manual = await findManualByAbbr(parsed.abbr, parsed.number);
    return {
      cards: dedup([...tcgCards, ...manual]),
      queryType: 'abbr-number',
      abbr: parsed.abbr,
      number: parsed.number,
    };
  }

  // Plain name: TCGdex (all langs) + manual DB + pokemontcg.io in parallel.
  // pokemontcg.io fills in EN cards not covered by TCGdex (dedup by ID removes duplicates).
  const [results, manualByName, ptcgioCards] = await Promise.all([
    Promise.allSettled(SEARCH_LANGS.map(l => searchCards(parsed.query, l))),
    findManualByName(parsed.query),
    searchPtcgIo(parsed.query),
  ]);
  const tcgCards = dedup(results.filter(r => r.status === 'fulfilled').flatMap(r => r.value));
  return { cards: dedup([...tcgCards, ...manualByName, ...ptcgioCards]), queryType: 'name' };
}

export async function getCard(id, lang = 'de') {
  try {
    const card = await get(`${BASE}/${lang}/cards/${id}`);
    return { ...card, _lang: lang };
  } catch {
    if (lang !== 'en') {
      try {
        const card = await get(`${BASE}/en/cards/${id}`);
        return { ...card, _lang: 'en' };
      } catch { /* fall through to manual */ }
    }
    const manual = await getManualCard(id);
    if (manual) return manual;
    const ptcgio = await getPtcgIoCard(id);
    if (ptcgio) return ptcgio;
    throw new Error(`Karte „${id}" nicht gefunden`);
  }
}

export async function getSets(lang = 'de') {
  const data = await get(`${BASE}/${lang}/sets`);
  if (!Array.isArray(data)) return [];
  return data;
}

export async function getSetDetail(setId, lang = 'de') {
  return get(`${BASE}/${lang}/sets/${setId}`);
}

// Direkter Link zur Karte auf Cardmarket. Bevorzugt die idProduct aus dem
// TCGdex-Pricing (eindeutiger Redirect), sonst Namens-Suche als Fallback.
export function cardmarketUrl(card) {
  const idProduct = card?.pricing?.cardmarket?.idProduct;
  if (idProduct) {
    return `https://www.cardmarket.com/de/Pokemon/Products?idProduct=${idProduct}`;
  }
  if (card?.name) {
    return `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`;
  }
  return null;
}

export function priceChartData(prices) {
  const points = [];
  const ago = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };
  if (prices.avg30 != null) points.push({ label: ago(30), datum: ago(30), preis: prices.avg30, typ: '30T-Avg' });
  if (prices.avg7 != null) points.push({ label: ago(7), datum: ago(7), preis: prices.avg7, typ: '7T-Avg' });
  if (prices.avg1 != null) points.push({ label: ago(1), datum: ago(1), preis: prices.avg1, typ: '1T-Avg' });
  if (prices.trend != null) points.push({ label: 'Trend', datum: 'Trend', preis: prices.trend, typ: 'Trend' });
  return points;
}

export function formatEur(value) {
  if (value == null || value <= 0) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

export function priceChange(prices) {
  const current = prices.avg1 ?? prices.trend;
  const older = prices.avg7 ?? prices.avg30;
  if (current == null || older == null || older === 0) return null;
  return ((current - older) / older) * 100;
}
