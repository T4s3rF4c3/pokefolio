import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSets } from '../api/tcgdex';
import { useLang, LANGS } from '../context/LangContext';

function SetCard({ set }) {
  const logo = set.logo ? `${set.logo}.webp` : null;
  const symbol = set.symbol ? `${set.symbol}.webp` : null;

  return (
    <Link
      to={`/set/${set.id}`}
      className="group flex flex-col bg-surface-2 border border-border rounded-xl overflow-hidden hover:border-poke-yellow/20 hover:bg-surface-3/15 transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/25 p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        {symbol && (
          <img src={symbol} alt="" className="w-8 h-8 object-contain" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{set.name}</p>
          <p className="text-xs text-slate-500">{set.releaseDate ?? '–'}</p>
        </div>
      </div>
      {logo ? (
        <div className="flex items-center justify-center h-16 mt-auto">
          <img src={logo} alt={set.name} className="max-h-full max-w-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
        </div>
      ) : (
        <div className="flex items-center justify-center h-16 mt-auto text-slate-700 text-xs">
          {set.id}
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className="text-xs text-slate-500">{set.cardCount?.total ?? set.total ?? '?'} Karten</span>
        <span className="text-xs text-slate-700 group-hover:text-poke-yellow transition-colors">Details →</span>
      </div>
    </Link>
  );
}

export default function Sets() {
  const { lang, setLang } = useLang();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setSets([]);
    getSets(lang)
      .then(data => setSets(data.reverse()))
      .catch(() => setSets([]))
      .finally(() => setLoading(false));
  }, [lang]);

  const filtered = sets.filter(s =>
    s.name?.toLowerCase().includes(filter.toLowerCase()) ||
    s.id?.toLowerCase().includes(filter.toLowerCase())
  );

  const grouped = {};
  for (const s of filtered) {
    const series = s.serie?.name ?? s.series ?? 'Sonstige';
    if (!grouped[series]) grouped[series] = [];
    grouped[series].push(s);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Alle Sets</h1>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Set filtern…"
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-poke-red transition-colors sm:max-w-xs"
          />
          <span className="text-slate-500 text-sm shrink-0">{filtered.length} Sets</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600">Sprache:</span>
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              title={l.name}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                lang === l.code
                  ? 'bg-poke-red/20 border-poke-red/50 text-poke-yellow font-semibold'
                  : 'border-border text-slate-500 hover:text-white hover:border-slate-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="bg-surface-2 border border-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="w-8 h-8 bg-surface-3 rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-surface-3 rounded w-3/4" />
                  <div className="h-3 bg-surface-3 rounded w-1/2" />
                </div>
              </div>
              <div className="h-16 bg-surface-3 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([series, seriesSets]) => (
            <div key={series}>
              <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-3">
                {series}
                <span className="flex-1 h-px bg-border/60" />
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {seriesSets.map(s => <SetCard key={s.id} set={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
