// pokemontcg.io — supplemental card source for cards not in TCGdex.
// Free tier: 1000 req/day without API key. All data in English.
// Card IDs are compatible with TCGdex (sv1-1, swsh1-1, …).

const BASE = 'https://api.pokemontcg.io/v2';

function mapCard(c) {
  const cm = c.cardmarket?.prices ?? {};
  return {
    id: c.id,
    _source: 'ptcgio',
    _lang: 'en',
    name: c.name,
    localId: c.number,
    set: {
      id: c.set?.id ?? null,
      name: c.set?.name ?? null,
    },
    image: null,
    imageSmall: c.images?.small ?? null,
    imageLarge: c.images?.large ?? null,
    rarity: c.rarity ?? null,
    types: c.types ?? [],
    category: c.supertype ?? null,
    stage: c.subtypes?.find(s =>
      ['Basic', 'Stage 1', 'Stage 2', 'VMAX', 'VSTAR', 'V', 'GX', 'EX'].includes(s)
    ) ?? null,
    hp: c.hp ? String(c.hp) : null,
    illustrator: c.artist ?? null,
    regulationMark: c.regulationMark ?? null,
    attacks: (c.attacks ?? []).map(a => ({
      name: a.name,
      damage: a.damage || null,
      effect: a.text || null,
      cost: a.cost ?? [],
    })),
    cardmarketUrl: c.cardmarket?.url ?? null,
    pricing: {
      cardmarket: {
        trend:        cm.trendPrice       ?? null,
        avg1:         cm.avg1             ?? null,
        avg7:         cm.avg7             ?? null,
        avg30:        cm.avg30            ?? null,
        low:          cm.lowPrice         ?? null,
        avg:          cm.averageSellPrice ?? null,
        'trend-holo': cm.reverseHoloTrend ?? null,
        'avg1-holo':  cm.reverseHoloAvg1  ?? null,
        'avg7-holo':  cm.reverseHoloAvg7  ?? null,
        'avg30-holo': cm.reverseHoloAvg30 ?? null,
      },
    },
  };
}

export async function searchPtcgIo(query) {
  try {
    const res = await fetch(
      `${BASE}/cards?q=name:"${encodeURIComponent(query)}"&pageSize=36&orderBy=-set.releaseDate`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map(mapCard);
  } catch {
    return [];
  }
}

export async function getPtcgIoCard(id) {
  try {
    const res = await fetch(`${BASE}/cards/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data ? mapCard(data.data) : null;
  } catch {
    return null;
  }
}
