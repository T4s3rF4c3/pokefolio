import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import CardTile from '../components/CardTile';
import ManualCardModal from '../components/ManualCardModal';
import CardScanModal from '../components/CardScanModal';
import { searchCardsMultiLang } from '../api/tcgdex';

const QUICK_SEARCHES = [
  { label: 'Charizard ex', q: 'Charizard ex' },
  { label: 'Pikachu ex',   q: 'Pikachu ex' },
  { label: 'Mewtwo ex',    q: 'Mewtwo ex' },
  { label: 'ASC 269',      q: 'ASC 269' },
  { label: 'sv1-1',        q: 'sv1-1' },
];

export default function Home() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const [cards, setCards] = useState([]);
  const [queryMeta, setQueryMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [showScan, setShowScan]     = useState(false);

  const runSearch = useCallback(() => {
    if (!q) { setCards([]); setQueryMeta(null); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    searchCardsMultiLang(q)
      .then(res => { setCards(res.cards); setQueryMeta(res); })
      .catch(() => { setCards([]); setQueryMeta(null); })
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(runSearch, [runSearch]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">

      {/* Hero — shown before any search */}
      {!searched && (
        <div className="relative text-center mb-12 pt-8 md:pt-14">
          {/* Subtle radial glow behind the hero */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden" aria-hidden>
            <div className="h-72 w-[700px] bg-poke-yellow/[0.04] blur-[110px] rounded-full" />
          </div>

          <div className="relative">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-3">
              <span className="gradient-text">Poké</span>Capital
            </h1>
            <p className="text-slate-400 text-base md:text-lg mb-8 max-w-md mx-auto leading-relaxed">
              Pokémon-Kartenpreise für europäische Sammler · Echtzeit-Daten von Cardmarket
            </p>

            <div className="flex justify-center items-center gap-2 mb-7">
              <SearchBar autoFocus />
              <button
                onClick={() => setShowScan(true)}
                title="Karte per KI scannen"
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border hover:border-poke-yellow/30 text-slate-500 hover:text-poke-yellow transition-all shrink-0"
              >
                <svg viewBox="0 0 20 20" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="5" height="5" rx="1"/>
                  <rect x="12" y="3" width="5" height="5" rx="1"/>
                  <rect x="3" y="12" width="5" height="5" rx="1"/>
                  <path d="M12 12h1m4 0h-1m-3 4v1m0-4v-1m4 4h-4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Clickable quick-search examples */}
            <div className="flex flex-wrap gap-2 justify-center items-center">
              <span className="text-xs text-slate-700">Beispiele:</span>
              {QUICK_SEARCHES.map(({ label, q: sq }) => (
                <Link
                  key={sq}
                  to={`/suche?q=${encodeURIComponent(sq)}`}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface-2/80 text-slate-400 hover:text-white hover:border-poke-yellow/30 hover:bg-surface-3/50 transition-all duration-150"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search results */}
      {searched && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <SearchBar compact />
            <div className="text-slate-500 text-sm shrink-0">
              {loading ? 'Suche…' : `${cards.length} Karten für „${q}"`}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-surface-2 border border-border rounded-xl overflow-hidden animate-pulse">
                  <div className="h-52 bg-surface-3" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-surface-3 rounded w-3/4" />
                    <div className="h-3 bg-surface-3 rounded w-1/2" />
                    <div className="h-4 bg-surface-3 rounded w-1/3 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-white mb-1">Keine Karten gefunden</p>
              <p className="text-sm text-slate-500 mb-6">für „{q}"</p>

              {queryMeta?.queryType === 'abbr-number' ? (
                <div className="w-full max-w-sm bg-amber-950/30 border border-amber-700/40 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-amber-300">Nicht in TCGdex-Datenbank</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Set-Kürzel{' '}
                    <span className="font-mono text-amber-300 bg-amber-900/30 px-1.5 py-0.5 rounded">
                      {queryMeta.abbr}
                    </span>{' '}
                    ist in der TCGdex API nicht vorhanden. Neue japanische High Class Packs oder asiatische Exklusivprodukte fehlen dort oft noch.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setShowModal(true)}
                      className="flex items-center justify-center gap-2 w-full text-sm font-medium bg-amber-900/25 hover:bg-amber-900/40 border border-amber-700/40 text-amber-300 rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Manuell eintragen
                    </button>
                    <a
                      href={`https://www.cardmarket.com/de/Pokemon/Products/Singles?searchString=${encodeURIComponent(q)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full text-sm font-medium bg-poke-yellow/8 hover:bg-poke-yellow/15 border border-poke-yellow/30 text-poke-yellow rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Auf Cardmarket suchen
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Versuche einen anderen Namen oder eine Setnummer wie sv1-1</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 fade-in">
              {cards.map(card => (
                <CardTile key={card.id + (card._lang ?? '')} card={card} />
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ManualCardModal
          abbr={queryMeta?.abbr ?? ''}
          number={queryMeta?.number ?? ''}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); runSearch(); }}
        />
      )}
      {showScan && <CardScanModal onClose={() => setShowScan(false)} />}
    </div>
  );
}
