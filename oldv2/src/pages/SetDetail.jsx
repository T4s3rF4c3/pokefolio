import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSetDetail, getCard, extractPrices, getPrimaryPrice, formatEur, cardImageSmall } from '../api/tcgdex';
import { useLang } from '../context/LangContext';

function CardRow({ card, lang, priceMap }) {
  const prices = priceMap?.[card.id] ?? extractPrices(card);
  const price = getPrimaryPrice(prices);
  const priceLoaded = priceMap && card.id in priceMap;
  const cardId = card.id ?? `${card.set?.id ?? ''}-${card.localId}`;

  return (
    <Link
      to={`/karte/${lang}/${cardId}`}
      className="flex items-center gap-3 py-2.5 px-3 hover:bg-white/5 rounded-lg transition-colors group"
    >
      <span className="text-xs text-slate-600 w-8 text-right shrink-0">#{card.localId}</span>
      <div className="w-8 h-11 shrink-0 rounded overflow-hidden bg-surface-3 flex items-center justify-center">
        {card.image ? (
          <img src={cardImageSmall(card.image)} alt={card.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <span className="text-xs text-slate-600">?</span>
        )}
      </div>
      <span className="flex-1 text-sm text-white truncate group-hover:text-poke-yellow transition-colors">{card.name}</span>
      {card.rarity && <span className="text-xs text-slate-600 shrink-0 hidden sm:block">{card.rarity}</span>}
      <span className={`text-sm font-semibold shrink-0 min-w-[3.5rem] text-right ${price ? 'text-poke-yellow' : 'text-slate-700'}`}>
        {!priceLoaded
          ? <span className="inline-block w-12 h-3.5 bg-surface-3 rounded animate-pulse" />
          : formatEur(price)
        }
      </span>
    </Link>
  );
}

export default function SetDetail() {
  const { id } = useParams();
  const { lang } = useLang();
  const [set, setSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('number');
  const [priceMap, setPriceMap] = useState({});

  useEffect(() => {
    setLoading(true);
    setSet(null);
    setError(null);
    setPriceMap({});
    getSetDetail(id, lang)
      .then(setSet)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, lang]);

  // Batch-fetch prices after set loads (20 at a time to avoid flooding the API)
  useEffect(() => {
    if (!set?.cards?.length) return;
    let cancelled = false;
    const cards = set.cards;
    const BATCH = 20;

    async function loadPrices() {
      for (let i = 0; i < cards.length; i += BATCH) {
        if (cancelled) return;
        await Promise.allSettled(
          cards.slice(i, i + BATCH).map(card =>
            getCard(card.id, lang)
              .then(full => {
                if (cancelled) return;
                setPriceMap(prev => ({ ...prev, [card.id]: extractPrices(full) }));
              })
              .catch(() => {
                if (!cancelled) setPriceMap(prev => ({ ...prev, [card.id]: extractPrices({}) }));
              })
          )
        );
      }
    }

    loadPrices();
    return () => { cancelled = true; };
  }, [set, lang]);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full animate-pulse space-y-4">
      <div className="h-8 bg-surface-2 rounded w-1/3" />
      <div className="h-4 bg-surface-2 rounded w-1/4" />
      <div className="h-96 bg-surface-2 rounded" />
    </div>
  );

  if (error) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-red-400">{error}</p>
      <Link to="/sets" className="text-poke-yellow hover:underline text-sm mt-4 inline-block">← Zurück zu Sets</Link>
    </div>
  );

  if (!set) return null;

  const cards = [...(set.cards ?? [])];
  const logo = set.logo ? `${set.logo}.webp` : null;
  const symbol = set.symbol ? `${set.symbol}.webp` : null;
  const totalCards = set.cardCount?.total ?? set.total ?? cards.length;

  const safeInt = (v) => { try { return parseInt(v, 10) || 0; } catch { return 0; } };
  const sorted = [...cards].sort((a, b) => {
    if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '', 'de');
    if (sortBy === 'price') {
      const pa = getPrimaryPrice(extractPrices(a)) ?? 0;
      const pb = getPrimaryPrice(extractPrices(b)) ?? 0;
      return pb - pa;
    }
    return safeInt(a.localId) - safeInt(b.localId);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full">
      <Link to="/sets" className="inline-flex items-center gap-1 text-slate-500 hover:text-white text-sm mb-6 transition-colors">
        ← Sets
      </Link>

      {/* Set header */}
      <div className="bg-surface-2 border border-border rounded-xl p-6 mb-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div className="flex items-center gap-4">
          {symbol && <img src={symbol} alt="" className="w-12 h-12 object-contain" />}
          {logo && <img src={logo} alt={set.name} className="h-12 max-w-xs object-contain" />}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{set.name}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
            <span>{set.serie?.name ?? '–'}</span>
            <span>Erschienen: {set.releaseDate ?? '–'}</span>
            <span>{totalCards} Karten</span>
            {set.abbreviation?.official && <span>Kürzel: {set.abbreviation.official}</span>}
          </div>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-600">Sortieren:</span>
        {['number', 'name', 'price'].map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === s ? 'bg-poke-red/20 border-poke-red/50 text-poke-yellow' : 'border-border text-slate-500 hover:text-white'}`}
          >
            {s === 'number' ? 'Nummer' : s === 'name' ? 'Name' : 'Preis'}
          </button>
        ))}
        <span className="text-xs text-slate-600 ml-auto">{cards.length} Karten</span>
      </div>

      {/* Card list */}
      {cards.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-12">Keine Karten im Set gefunden</p>
      ) : (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden divide-y divide-border/50">
          {sorted.map(card => (
            <CardRow key={card.id ?? card.localId} card={card} lang={lang} priceMap={priceMap} />
          ))}
        </div>
      )}
    </div>
  );
}
