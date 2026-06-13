import { extractPrices, priceForEntry } from '../shared/pricing.js';

const TCGDEX = 'https://api.tcgdex.net/v2';

async function fetchCard(cardId, lang) {
  const langs = lang && lang !== 'en' ? [lang, 'en'] : ['en'];
  for (const l of langs) {
    try {
      const res = await fetch(`${TCGDEX}/${l}/cards/${cardId}`);
      if (res.ok) return await res.json();
    } catch { /* nächste Sprache versuchen */ }
  }
  return null;
}

// Tages-Snapshot: holt Preise für alle Karten der Sammlung, speichert
// CardSnapshots und den Portfolio-Gesamtwert. Identische Logik wie die
// Portfolio-Seite (shared/pricing.js), läuft aber auch ohne offenen Browser.
export async function runDailySnapshot(prisma, { force = false } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  if (!force) {
    const existing = await prisma.portfolioSnapshot.findUnique({ where: { date } });
    if (existing) return { date, skipped: true };
  }

  const rows = await prisma.collectionEntry.findMany();
  const entries = rows.map(r => JSON.parse(r.data));
  if (entries.length === 0) return { date, skipped: true };

  // Preise nur einmal pro Karte holen (mehrere Varianten teilen sich die Karte)
  const uniqueCards = new Map();
  for (const e of entries) if (!uniqueCards.has(e.cardId)) uniqueCards.set(e.cardId, e.lang);

  const priceMap = {};
  for (const [cardId, lang] of uniqueCards) {
    let card = await fetchCard(cardId, lang);
    if (!card) {
      const mc = await prisma.manualCard.findUnique({ where: { id: cardId } });
      if (mc) card = JSON.parse(mc.data);
    }
    if (!card) continue;
    const prices = extractPrices(card);
    priceMap[cardId] = prices;
    if (prices.trend ?? prices.avg7 ?? prices.avg30) {
      await prisma.cardSnapshot.upsert({
        where: { cardId_date: { cardId, date } },
        create: { cardId, date, trend: prices.trend, avg7: prices.avg7, avg30: prices.avg30 },
        update: { trend: prices.trend, avg7: prices.avg7, avg30: prices.avg30 },
      });
    }
  }

  let total = 0;
  for (const e of entries) {
    const p = priceForEntry(e, priceMap[e.cardId] ?? null);
    if (p) total += p * (e.qty ?? 1);
  }
  if (total > 0) {
    const value = Math.round(total * 100) / 100;
    await prisma.portfolioSnapshot.upsert({ where: { date }, create: { date, value }, update: { value } });
  }
  return { date, value: total, cards: uniqueCards.size };
}

// Beim Start nachholen (falls heute noch kein Snapshot existiert) und danach
// täglich um 12:00 aktualisieren.
export function scheduleDailySnapshot(prisma) {
  const run = (force) => runDailySnapshot(prisma, { force })
    .then(r => console.log(`[snapshot] ${r.skipped ? 'übersprungen (heute bereits vorhanden)' : `${r.date}: ${r.value?.toFixed(2)} € (${r.cards} Karten)`}`))
    .catch(err => console.error('[snapshot] Fehler:', err.message));

  setTimeout(() => run(false), 15_000);

  const next = new Date();
  next.setHours(12, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  const tick = () => { run(true); setTimeout(tick, 24 * 60 * 60 * 1000); };
  setTimeout(tick, next.getTime() - Date.now());
}
