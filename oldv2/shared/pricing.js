// Gemeinsame Preis-Logik für Frontend (src/) und Backend (server/).
// Reine Funktionen ohne Abhängigkeiten – darf von beiden Seiten importiert werden.

// Cardmarket liefert 0 statt null für nicht existierende Varianten-Preise
// (z.B. trend-holo: 0 bei Holo-only-Karten, deren Preise in den Normal-Feldern
// stehen) → 0 bedeutet "kein Preis", nicht "kostenlos".
function num(v) {
  return typeof v === 'number' && v > 0 ? v : null;
}

export function extractPrices(card) {
  const cm = card?.pricing?.cardmarket ?? {};
  const tcp = card?.pricing?.tcgplayer ?? {};
  return {
    // Cardmarket EUR
    trend: num(cm.trend),
    avg1: num(cm.avg1),
    avg7: num(cm.avg7),
    avg30: num(cm.avg30),
    market: num(cm.avg),
    low: num(cm.low),
    // Holo
    trendHolo: num(cm['trend-holo']),
    avg1Holo: num(cm['avg1-holo']),
    avg7Holo: num(cm['avg7-holo']),
    avg30Holo: num(cm['avg30-holo']),
    marketHolo: num(cm['avg-holo']),
    lowHolo: num(cm['low-holo']),
    // TCGPlayer USD
    tcgNormalLow: num(tcp.normal?.lowPrice),
    tcgNormalMid: num(tcp.normal?.midPrice),
    tcgNormalMarket: num(tcp.normal?.marketPrice),
    tcgHoloLow: num(tcp.holofoil?.lowPrice),
    tcgHoloMid: num(tcp.holofoil?.midPrice),
    tcgHoloMarket: num(tcp.holofoil?.marketPrice),
  };
}

export function getPrimaryPrice(prices) {
  return prices.trend ?? prices.avg1 ?? prices.avg7 ?? prices.avg30 ?? prices.market ?? null;
}

// Preis für einen Sammlungs-Eintrag anhand seiner Variante.
// Holo-Einträge nutzen die Holo-Felder, fallen aber auf Normal-Preise zurück
// (Holo-only-Karten haben ihre Preise bei Cardmarket in den Normal-Feldern).
export function priceForEntry(entry, prices) {
  if (!prices) return null;
  const wantsHolo = entry.variant ? entry.variant === 'holo' : !!entry.isHolo;
  if (wantsHolo) {
    return prices.trendHolo ?? prices.avg1Holo ?? prices.avg7Holo
      ?? prices.avg30Holo ?? prices.marketHolo ?? getPrimaryPrice(prices);
  }
  return getPrimaryPrice(prices);
}

// Eindeutiger Schlüssel eines Sammlungs-Eintrags (eine Karte kann in mehreren
// Varianten gleichzeitig in der Sammlung sein).
export function entryVariant(entry) {
  return entry.variant ?? (entry.isHolo ? 'holo' : 'normal');
}

export function entryKey(cardIdOrEntry, variant) {
  if (typeof cardIdOrEntry === 'object') {
    return `${cardIdOrEntry.cardId}:${entryVariant(cardIdOrEntry)}`;
  }
  return `${cardIdOrEntry}:${variant ?? 'normal'}`;
}
