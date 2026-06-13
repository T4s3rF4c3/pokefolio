// Cardmarket price data via Vite dev-server proxy (/cm-s3).
// The price guide S3 endpoint has no Cloudflare — works reliably.
// The Cardmarket website is Cloudflare-protected — we avoid fetching it.

const PRICE_GUIDE_URL = '/cm-s3/productCatalog/priceGuide/price_guide_6.json';

// Module-level cache: Map<idProduct, priceEntry> — survives the session
let _priceGuide = null;
let _priceGuidePromise = null;

export async function loadPriceGuide() {
  if (_priceGuide) return _priceGuide;
  if (!_priceGuidePromise) {
    _priceGuidePromise = fetch(PRICE_GUIDE_URL)
      .then(r => { if (!r.ok) throw new Error(`Price guide HTTP ${r.status}`); return r.json(); })
      .then(data => {
        _priceGuide = new Map(
          (data.priceGuides ?? []).map(p => [Number(p.idProduct), p])
        );
        return _priceGuide;
      });
  }
  return _priceGuidePromise;
}

export async function getPriceByIdProduct(idProduct) {
  const guide = await loadPriceGuide();
  return guide.get(Number(idProduct)) ?? null;
}

// ---------------------------------------------------------------------------
// Parse any Cardmarket-related input to extract idProduct + setCode.
//
// Accepted formats:
//  1. Product image URL (right-click card image → copy address):
//     https://product-images.s3.cardmarket.com/51/M2A/123456/123456.jpg
//
//  2. Plain idProduct number:
//     123456
//
//  3. Product page URL (setCode/name parsed from path, no page fetch):
//     https://www.cardmarket.com/de/Pokemon/Products/Singles/MEGA-Dream-ex/Dragonite-M2A232
// ---------------------------------------------------------------------------
export function parseCardmarketInput(input) {
  const s = (input ?? '').trim();

  // 1. Cardmarket S3 image CDN URL — most reliable, contains idProduct directly
  const imgMatch = s.match(/product-images\.s3\.cardmarket\.com\/51\/([^/]+)\/(\d+)\//i);
  if (imgMatch) {
    return {
      source: 'image-url',
      setCode: imgMatch[1].toUpperCase(),
      idProduct: parseInt(imgMatch[2], 10),
    };
  }

  // 2. Plain idProduct number
  if (/^\d{5,7}$/.test(s)) {
    return { source: 'id', setCode: null, idProduct: parseInt(s, 10) };
  }

  // 3. Cardmarket product page URL — parse name/set from path, no fetch needed
  if (s.includes('cardmarket.com')) {
    try {
      const u = new URL(s);

      // Extract idProduct from query param if present (e.g. from a direct offer link)
      const qId = u.searchParams.get('idProduct');
      if (qId) {
        return { source: 'id', setCode: null, idProduct: parseInt(qId, 10) };
      }

      // Parse /Singles/{set-slug}/{card-slug}
      const parts = u.pathname.split('/').filter(Boolean);
      const singlesIdx = parts.findIndex(p => p === 'Singles');
      if (singlesIdx !== -1 && singlesIdx + 2 < parts.length) {
        const setSlug  = parts[singlesIdx + 1];
        const cardSlug = parts[singlesIdx + 2];
        const setName  = setSlug.replace(/-/g, ' ');

        // Extract setCode + number from end of card slug
        const m = cardSlug.match(/[^-]*-([A-Za-z][A-Za-z0-9]*?[A-Za-z])(\d{1,4})$/);
        return {
          source: 'page-url',
          setCode:    m ? m[1].toUpperCase() : null,
          cardNumber: m ? m[2] : null,
          cardName:   m
            ? cardSlug.slice(0, cardSlug.lastIndexOf('-' + m[1] + m[2])).replace(/-/g, ' ')
            : cardSlug.replace(/-/g, ' '),
          setName,
          idProduct: null, // not known yet — user must provide image URL or id
        };
      }
    } catch { /* ignore */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Full import: parse input → fetch price guide → return card data.
// Never fetches the Cloudflare-protected Cardmarket website.
// ---------------------------------------------------------------------------
export async function importFromCardmarket(input, fallbackSetCode = null) {
  const parsed = parseCardmarketInput(input);

  if (!parsed) throw new Error('Eingabe nicht erkannt. Bitte Bild-URL oder idProduct-Nummer einfügen.');

  if (parsed.source === 'page-url' && parsed.idProduct == null) {
    // We can extract name/set from the URL, but can't get prices without idProduct
    // Return partial data so the form is at least pre-filled
    return {
      idProduct: null,
      setCode: parsed.setCode,
      cardNumber: parsed.cardNumber,
      cardName: parsed.cardName,
      setName: parsed.setName,
      imageUrl: null,
      pricing: null,
      partial: true,
    };
  }

  const { idProduct, setCode: codeFromInput } = parsed;
  const effectiveSetCode = (codeFromInput ?? fallbackSetCode ?? '').toUpperCase() || null;

  // Look up price guide (14 MB, cached after first load)
  const prices = await getPriceByIdProduct(idProduct);

  const imageUrl = effectiveSetCode
    ? `https://product-images.s3.cardmarket.com/51/${effectiveSetCode}/${idProduct}/${idProduct}.jpg`
    : null;

  return {
    idProduct,
    setCode:    parsed.setCode    ?? effectiveSetCode ?? '',
    cardNumber: parsed.cardNumber ?? null,
    cardName:   parsed.cardName   ?? null,
    setName:    parsed.setName    ?? null,
    imageUrl,
    pricing: prices ? {
      trend: prices.trend ?? null,
      avg1:  prices.avg1  ?? null,
      avg7:  prices.avg7  ?? null,
      avg30: prices.avg30 ?? null,
      low:   prices.low   ?? null,
    } : null,
  };
}
