import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCard, extractPrices, formatEur, getPrimaryPrice, priceChange, cardImageLarge, cardmarketUrl, entryVariant } from '../api/tcgdex';
import { LANGS } from '../context/LangContext';
import PriceTable from '../components/PriceTable';
import ManualCardModal from '../components/ManualCardModal';
import CollectionModal, { VARIANT_LABELS } from '../components/CollectionModal';
import { getCollectionEntries, getCardSnapshots } from '../data/collection';

// Recharts nur laden, wenn die Detailseite wirklich angezeigt wird
const PriceChart = lazy(() => import('../components/PriceChart'));

const TYPE_COLORS = {
  Fire: 'bg-red-900/50 text-red-300',
  Water: 'bg-blue-900/50 text-blue-300',
  Grass: 'bg-green-900/50 text-green-300',
  Lightning: 'bg-yellow-900/50 text-yellow-300',
  Psychic: 'bg-purple-900/50 text-purple-300',
  Fighting: 'bg-orange-900/50 text-orange-300',
  Darkness: 'bg-gray-800/80 text-gray-300',
  Metal: 'bg-slate-700/80 text-slate-300',
  Dragon: 'bg-indigo-900/50 text-indigo-300',
  Fairy: 'bg-pink-900/50 text-pink-300',
  Colorless: 'bg-zinc-700/50 text-zinc-300',
};

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-white font-medium text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

export default function CardDetail() {
  const { lang, id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [holoMode, setHoloMode] = useState(false);
  const [showTcg, setShowTcg] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionEntries, setCollectionEntries] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setHistory([]);
    getCard(id, lang)
      .then(async c => {
        setCard(c);
        setCollectionEntries(await getCollectionEntries(c.id));
        getCardSnapshots(c.id).then(setHistory).catch(() => setHistory([]));
        const v = c.variants ?? {};
        const p = extractPrices(c);
        const holoOnly = v.holo === true && !v.normal;
        const hasHolo = [p.trendHolo, p.avg1Holo, p.avg7Holo].some(Boolean);
        if (holoOnly && hasHolo) setHoloMode(true);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, lang]);

  function handleManualSaved(savedId) {
    setShowEditModal(false);
    if (!savedId) { navigate('/'); return; }
    getCard(id, lang).then(setCard).catch(e => setError(e.message));
  }

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="animate-pulse flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-72 h-96 bg-surface-2 rounded-2xl" />
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-surface-2 rounded w-1/2" />
          <div className="h-4 bg-surface-2 rounded w-1/3" />
          <div className="h-48 bg-surface-2 rounded" />
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <p className="text-red-400 font-medium">{error}</p>
      <Link to="/" className="mt-4 inline-block text-poke-yellow hover:underline text-sm">← Zurück zur Suche</Link>
    </div>
  );

  if (!card) return null;

  const prices = extractPrices(card);
  const variants = card.variants ?? {};
  const isHoloOnly = variants.holo === true && !variants.normal;
  const hasNormalPrices = [prices.trend, prices.avg1, prices.avg7].some(Boolean);
  const hasHoloPrices   = [prices.trendHolo, prices.avg1Holo, prices.avg7Holo].some(Boolean);
  const canToggleMode   = hasNormalPrices && hasHoloPrices && !isHoloOnly;
  const activePrices = holoMode ? {
    trend: prices.trendHolo, avg1: prices.avg1Holo, avg7: prices.avg7Holo,
    avg30: prices.avg30Holo, market: prices.marketHolo, low: prices.lowHolo,
  } : prices;
  const primaryPrice = getPrimaryPrice(activePrices);
  const change = priceChange(activePrices);
  const hasTcgPrices = [prices.tcgNormalMarket, prices.tcgHoloMarket].some(Boolean);
  const types = card.types ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full">
      <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-white text-sm mb-6 transition-colors">
        ← Suche
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Card image */}
        <div className="flex flex-col items-center gap-4 lg:w-72 shrink-0">
          <div className="relative bg-gradient-to-b from-surface-3 to-surface-2 rounded-2xl p-6 w-full flex items-center justify-center"
            style={{ minHeight: 300 }}>
            {(card.imageLarge || card.imageSmall || card.image) ? (
              <img
                src={card.imageLarge ?? card.imageSmall ?? cardImageLarge(card.image)}
                alt={card.name}
                className="max-w-full max-h-72 object-contain drop-shadow-2xl"
              />
            ) : (
              <div className="w-48 h-64 rounded-xl border border-border/40 flex items-center justify-center">
                <svg className="w-16 h-16 text-surface-3" viewBox="0 0 40 56" fill="none">
                  <rect x="1" y="1" width="38" height="54" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                  <circle cx="20" cy="24" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
                  <line x1="20" y1="15" x2="20" y2="33" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                  <line x1="11" y1="24" x2="29" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                </svg>
              </div>
            )}
          </div>

          {/* Variant badges */}
          <div className="flex flex-wrap gap-2 justify-center">
            {variants.normal && <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-1 rounded-full">Normal</span>}
            {variants.holo && <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-1 rounded-full">Holo</span>}
            {variants.reverse && <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-1 rounded-full">Reverse Holo</span>}
            {variants.firstEdition && <span className="text-xs bg-amber-900/60 text-amber-300 px-2 py-1 rounded-full">1. Edition</span>}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-start gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{card.name}</h1>
              {types.map(t => (
                <span key={t} className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[t] ?? 'bg-slate-700 text-slate-300'}`}>
                  {t}
                </span>
              ))}
              {card.rarity && (
                <span className="text-xs bg-poke-red/20 text-poke-yellow px-2.5 py-1 rounded-full font-medium">
                  {card.rarity}
                </span>
              )}
              {card._source === 'manual' && (
                <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-700/50 px-2.5 py-1 rounded-full font-medium">
                  Manuelle Daten
                </span>
              )}
              {card._source === 'ptcgio' && (
                <span className="text-xs bg-sky-900/50 text-sky-300 border border-sky-700/50 px-2.5 py-1 rounded-full font-medium">
                  pokemontcg.io
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-slate-500 text-sm">
                {card.set?.name ?? '–'} · #{card.localId}
              </p>
              {card._source === 'manual' && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-300 transition-colors"
                  title="Eintrag bearbeiten"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Bearbeiten
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {LANGS.map(l => (
                <Link
                  key={l.code}
                  to={`/karte/${l.code}/${id}`}
                  title={l.name}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    l.code === lang
                      ? 'bg-poke-red/20 border-poke-red/50 text-poke-yellow font-semibold'
                      : 'border-border text-slate-500 hover:text-white hover:border-slate-500'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Collection button + Cardmarket link */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowCollectionModal(true)}
                className={`inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 transition-colors ${
                  collectionEntries.length > 0
                    ? 'bg-green-900/30 border border-green-700/50 text-green-400 hover:bg-green-900/50'
                    : 'bg-surface-3 border border-border text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                <svg className="w-4 h-4" fill={collectionEntries.length > 0 ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8" />
                </svg>
                {collectionEntries.length > 0
                  ? `In Sammlung · ${collectionEntries
                      .map(e => `${e.qty}× ${VARIANT_LABELS[entryVariant(e)] ?? entryVariant(e)}`)
                      .join(' · ')}`
                  : 'Zur Sammlung hinzufügen'}
              </button>

              {cardmarketUrl(card) && (
                <a
                  href={cardmarketUrl(card)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 bg-[#012169]/30 border border-[#3d5fa8]/50 text-[#8eaadc] hover:bg-[#012169]/50 hover:text-white transition-colors"
                  title="Karte auf Cardmarket öffnen"
                >
                  Cardmarket
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Price hero */}
          <div className="bg-gradient-to-br from-poke-yellow/6 via-surface-2 to-surface-2 border border-poke-yellow/15 rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[10px] text-poke-yellow/60 uppercase tracking-widest font-semibold mb-1.5">Cardmarket Trend</p>
              <p className={`text-4xl font-black leading-none ${primaryPrice ? 'text-poke-yellow' : 'text-slate-600'}`}>
                {formatEur(primaryPrice)}
              </p>
            </div>
            {change != null && (
              <div className={`text-xl font-bold ${change > 0 ? 'price-up' : change < 0 ? 'price-down' : 'price-neutral'}`}>
                {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                <p className="text-xs font-normal text-slate-500 mt-0.5">vs. 7-Tage-Ø</p>
              </div>
            )}
            {activePrices.avg7 && (
              <div className="text-xs text-slate-500 ml-auto space-y-1">
                <p>7T-Ø <span className="text-white font-medium">{formatEur(activePrices.avg7)}</span></p>
                <p>30T-Ø <span className="text-white font-medium">{formatEur(activePrices.avg30)}</span></p>
              </div>
            )}
          </div>

          {/* Price chart */}
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Preisverlauf</h2>
              <div className="flex gap-2">
                {canToggleMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHoloMode(false)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${!holoMode ? 'bg-slate-700/60 border-slate-500 text-white' : 'border-border text-slate-500 hover:text-white'}`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setHoloMode(true)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${holoMode ? 'bg-purple-900/60 border-purple-700 text-purple-300' : 'border-border text-slate-500 hover:text-white'}`}
                    >
                      Holo
                    </button>
                  </div>
                )}
              </div>
            </div>
            <Suspense fallback={<div className="h-64 skeleton rounded-lg" />}>
              <PriceChart prices={prices} holoMode={holoMode} history={history} />
            </Suspense>
          </div>

          {/* Price table */}
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Alle Preise</h2>
              {hasTcgPrices && (
                <button
                  onClick={() => setShowTcg(s => !s)}
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >
                  {showTcg ? 'TCGPlayer ausblenden' : 'TCGPlayer (USD) anzeigen'}
                </button>
              )}
            </div>
            <PriceTable prices={prices} holoMode={holoMode} showTcg={showTcg} />
          </div>

          {/* Card info */}
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Karteninfo</h2>
            <div className="space-y-0.5">
              <InfoRow label="Kategorie" value={card.category} />
              <InfoRow label="Stufe" value={card.stage} />
              <InfoRow label="HP" value={card.hp} />
              <InfoRow label="Entwickelt von" value={card.evolveFrom} />
              <InfoRow label="Rückzug" value={card.retreat != null ? `${card.retreat} ◆` : null} />
              <InfoRow label="Reglermarke" value={card.regulationMark} />
              <InfoRow label="Illustrator" value={card.illustrator} />
              <InfoRow label="Suffix" value={card.suffix} />
            </div>
          </div>

          {/* Attacks */}
          {card.attacks?.length > 0 && (
            <div className="bg-surface-2 border border-border rounded-xl p-4">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Attacken</h2>
              <div className="space-y-3">
                {card.attacks.map((atk, i) => (
                  <div key={i} className="bg-surface-3/50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-white">{atk.name}</span>
                      {atk.damage && <span className="text-sm font-bold text-poke-yellow">{atk.damage}</span>}
                    </div>
                    {atk.effect && <p className="text-xs text-slate-400">{atk.effect}</p>}
                    {atk.cost?.length > 0 && (
                      <p className="text-xs text-slate-600 mt-1">Kosten: {atk.cost.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <ManualCardModal
          cardId={id}
          onClose={() => setShowEditModal(false)}
          onSaved={handleManualSaved}
        />
      )}

      {showCollectionModal && card && (
        <CollectionModal
          card={card}
          initialVariant={isHoloOnly || holoMode ? 'holo' : 'normal'}
          onClose={() => setShowCollectionModal(false)}
          onSaved={() => { getCollectionEntries(card.id).then(setCollectionEntries); }}
        />
      )}
    </div>
  );
}
