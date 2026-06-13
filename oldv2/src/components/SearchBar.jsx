import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCardsMultiLang, parseQuery, cardImageSmall, formatEur, getPrimaryPrice, extractPrices } from '../api/tcgdex';

const MODE_LABELS = {
  'tcgdex-id':    { text: 'Karten-ID',        cls: 'bg-blue-900/60 text-blue-300' },
  'abbr-number':  { text: 'Set-Kürzel + Nr.',  cls: 'bg-amber-900/60 text-amber-300' },
  'name':         { text: null,                cls: '' },
};

export default function SearchBar({ autoFocus = false, compact = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const parsed = query.trim().length >= 2 ? parseQuery(query.trim()) : null;
  const modeLabel = parsed ? MODE_LABELS[parsed.type] : null;
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const search = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const { cards } = await searchCardsMultiLang(q.trim());
      setResults(cards.slice(0, 12));
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 400);
    return () => clearTimeout(timerRef.current);
  }, [query, search]);

  const submit = (e) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setOpen(false);
    navigate(`/suche?q=${encodeURIComponent(query.trim())}`);
  };

  const pick = (card) => {
    setOpen(false);
    setQuery('');
    navigate(`/karte/${card._lang}/${card.id}`);
  };

  return (
    <div className={`relative w-full ${compact ? 'max-w-lg' : 'max-w-2xl'}`}>
      <form onSubmit={submit} className="search-pulse">
        <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-4 py-3 focus-within:border-poke-red transition-colors">
          <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
          </svg>
          <input
            ref={inputRef}
            autoFocus={autoFocus}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Karte suchen… z.B. Pikachu, ASC 269, sv1-1"
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
          />
          {modeLabel?.text && !loading && (
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${modeLabel.cls}`}>
              {modeLabel.text}
            </span>
          )}
          {loading && (
            <svg className="w-4 h-4 text-slate-500 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {query && !loading && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
              className="text-slate-500 hover:text-white transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-surface-2 border border-border rounded-xl shadow-2xl z-50 overflow-hidden fade-in">
          {results.map((card) => {
            const prices = extractPrices(card);
            const price = getPrimaryPrice(prices);
            return (
              <button
                key={card.id + card._lang}
                onMouseDown={() => pick(card)}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-9 h-12 flex-shrink-0 rounded overflow-hidden bg-surface-3 flex items-center justify-center">
                  {(card.image || card.imageSmall) ? (
                    <img src={card.imageSmall ?? cardImageSmall(card.image)} alt={card.name}
                      className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <span className="text-xs text-slate-600">?</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{card.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {card.set?.name ?? '–'} · #{card.localId}
                    <span className="ml-1.5 text-[10px] font-semibold bg-surface-3 text-slate-400 px-1 py-0.5 rounded">
                      {(card._lang ?? 'de').toUpperCase().replace('ZH-TW', 'ZH')}
                    </span>
                  </p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${price ? 'text-poke-yellow' : 'text-slate-600'}`}>
                  {formatEur(price)}
                </span>
              </button>
            );
          })}
          <button
            onMouseDown={() => { setOpen(false); navigate(`/suche?q=${encodeURIComponent(query.trim())}`); }}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-xs text-slate-500 hover:text-white border-t border-border transition-colors"
          >
            Alle Ergebnisse für „{query}" anzeigen →
          </button>
        </div>
      )}
    </div>
  );
}
