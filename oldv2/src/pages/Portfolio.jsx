import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getCollection, getPortfolioHistory, saveCardSnapshot, savePortfolioSnapshot,
} from '../data/collection';
import { getCard, extractPrices, formatEur, cardImageSmall, priceForEntry, entryKey, entryVariant } from '../api/tcgdex';
import { CONDITIONS, VARIANT_LABELS } from '../components/CollectionModal';
import CollectionModal from '../components/CollectionModal';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

function conditionLabel(code) {
  return CONDITIONS.find(c => c.code === code)?.label ?? code;
}

function StatCard({ label, value, sub, highlight }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-1.5">{label}</p>
      <p className={`text-xl font-bold ${highlight ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function SortHeader({ label, field, sortBy, sortDir, onSort }) {
  const active = sortBy === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${active ? 'text-poke-yellow' : 'text-slate-500 hover:text-white'}`}
    >
      {label}
      <span className="text-[10px] opacity-60">
        {active ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
      </span>
    </button>
  );
}

function PortfolioTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-0.5">{payload[0]?.payload?.date}</p>
      <p className="text-poke-yellow font-bold text-sm">{formatEur(payload[0]?.value)}</p>
    </div>
  );
}

export default function Portfolio() {
  const [collection, setCollection] = useState([]);
  const [priceMap, setPriceMap]           = useState({});
  const [loading, setLoading]             = useState(true);
  const [portfolioHistory, setPortfolioHistory] = useState([]);

  useEffect(() => {
    getCollection().then(setCollection);
    getPortfolioHistory().then(setPortfolioHistory);
  }, []);
  const [sortBy, setSortBy]               = useState('value');
  const [sortDir, setSortDir]             = useState('desc');
  const [editCard, setEditCard]           = useState(null);
  const [editVariant, setEditVariant]     = useState('normal');
  const [lastUpdated, setLastUpdated]     = useState(null);

  useEffect(() => {
    if (collection.length === 0) { setLoading(false); return; }
    setLoading(true);
    let cancelled = false;

    async function load() {
      const map = {};
      const CONCURRENCY = 3;
      // Preise nur einmal pro Karte laden – mehrere Varianten teilen sich die Karte
      const uniqueCards = [...new Map(collection.map(e => [e.cardId, e])).values()];

      for (let i = 0; i < uniqueCards.length; i += CONCURRENCY) {
        if (cancelled) return;
        const batch = uniqueCards.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(entry =>
            getCard(entry.cardId, entry.lang)
              .then(card => ({ cardId: entry.cardId, prices: extractPrices(card) }))
              .catch(() => ({ cardId: entry.cardId, prices: null }))
          )
        );
        if (cancelled) return;

        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          const { cardId, prices } = r.value;
          map[cardId] = prices;
          if (prices && (prices.trend ?? prices.avg7 ?? prices.avg30)) {
            saveCardSnapshot(cardId, { trend: prices.trend, avg7: prices.avg7, avg30: prices.avg30 });
          }
        }
        // Progressive update so prices appear as they load
        setPriceMap(prev => ({ ...prev, ...map }));
      }

      if (cancelled) return;
      const totalValue = collection.reduce((sum, entry) => {
        const p = priceForEntry(entry, map[entry.cardId] ?? null);
        return p ? sum + p * entry.qty : sum;
      }, 0);
      if (totalValue > 0) {
        await savePortfolioSnapshot(totalValue);
        if (!cancelled) setPortfolioHistory(await getPortfolioHistory());
      }
      if (!cancelled) {
        setPriceMap({ ...map });
        setLastUpdated(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [collection]);

  const handleSort = useCallback((field) => {
    setSortDir(d => sortBy === field ? (d === 'desc' ? 'asc' : 'desc') : 'desc');
    setSortBy(field);
  }, [sortBy]);

  const enriched = useMemo(() => {
    return collection.map(entry => {
      const prices = priceMap[entry.cardId] ?? null;
      const currentPrice = priceForEntry(entry, prices);
      const currentValue = currentPrice != null ? currentPrice * entry.qty : null;
      const purchaseValue = entry.purchasePrice != null ? entry.purchasePrice * entry.qty : null;
      const pnl = currentValue != null && purchaseValue != null ? currentValue - purchaseValue : null;
      const pnlPct = pnl != null && purchaseValue > 0 ? (pnl / purchaseValue) * 100 : null;
      return { ...entry, currentPrice, currentValue, purchaseValue, pnl, pnlPct };
    });
  }, [collection, priceMap]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...enriched].sort((a, b) => {
      if (sortBy === 'name') return dir * (a.name ?? '').localeCompare(b.name ?? '');
      if (sortBy === 'value') return dir * ((a.currentValue ?? -Infinity) - (b.currentValue ?? -Infinity));
      if (sortBy === 'pnl') return dir * ((a.pnl ?? -Infinity) - (b.pnl ?? -Infinity));
      if (sortBy === 'qty') return dir * (a.qty - b.qty);
      return 0;
    });
  }, [enriched, sortBy, sortDir]);

  const totalCurrentValue  = enriched.reduce((s, e) => s + (e.currentValue ?? 0), 0);
  const totalPurchaseValue = enriched.reduce((s, e) => s + (e.purchaseValue ?? 0), 0);
  const totalPnl    = totalCurrentValue > 0 && totalPurchaseValue > 0 ? totalCurrentValue - totalPurchaseValue : null;
  const totalPnlPct = totalPnl != null && totalPurchaseValue > 0 ? (totalPnl / totalPurchaseValue) * 100 : null;
  const totalUnits  = enriched.reduce((s, e) => s + e.qty, 0);
  const hasPurchasePrices = enriched.some(e => e.purchasePrice != null);

  // Veränderung gegenüber dem letzten Snapshot vor heute
  const today = new Date().toISOString().slice(0, 10);
  const prevSnapshot = [...portfolioHistory].reverse().find(h => h.date < today) ?? null;
  const dayChange = !loading && prevSnapshot && totalCurrentValue > 0
    ? totalCurrentValue - prevSnapshot.value
    : null;

  if (collection.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Meine Sammlung</h1>
        <p className="text-slate-400 mb-6 max-w-sm mx-auto">
          Noch keine Karten in der Sammlung. Öffne eine Karte und füge sie über den Button hinzu.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 bg-poke-yellow/10 hover:bg-poke-yellow/18 border border-poke-yellow/35 text-poke-yellow rounded-lg px-5 py-2.5 text-sm font-medium transition-colors">
          Karten suchen
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full">

      {/* Hero value card */}
      <div className="bg-gradient-to-br from-poke-yellow/7 via-surface-2 to-surface-2 border border-poke-yellow/18 rounded-2xl px-6 py-5 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[10px] text-poke-yellow/60 uppercase tracking-widest font-semibold mb-1.5">Aktueller Wert</p>
          {loading ? (
            <div className="h-11 w-36 skeleton rounded-lg" />
          ) : (
            <p className="text-4xl md:text-5xl font-black text-poke-yellow leading-none">
              {formatEur(totalCurrentValue)}
            </p>
          )}
          {dayChange != null && Math.abs(dayChange) >= 0.01 && (
            <p className={`text-sm font-semibold mt-1.5 ${dayChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {dayChange > 0 ? '+' : '−'}{formatEur(Math.abs(dayChange))} seit {prevSnapshot.date.slice(8, 10)}.{prevSnapshot.date.slice(5, 7)}.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1.5">
            {collection.length} Karten · {totalUnits} Exemplare
            {lastUpdated ? ` · Stand ${lastUpdated}` : ''}
          </p>
        </div>
        {totalPnl != null && !loading && (
          <div className={`sm:text-right ${totalPnl > 0 ? 'text-green-400' : totalPnl < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            <p className="text-2xl font-bold">
              {totalPnl > 0 ? '+' : ''}{formatEur(totalPnl)}
            </p>
            {totalPnlPct != null && (
              <p className="text-sm font-semibold opacity-80">
                {totalPnlPct > 0 ? '+' : ''}{totalPnlPct.toFixed(1)} %
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5">Gesamtperformance</p>
          </div>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Einkaufswert"
          value={hasPurchasePrices ? formatEur(totalPurchaseValue) : '–'}
          sub={hasPurchasePrices ? null : 'Kaufpreis nicht erfasst'}
        />
        <StatCard
          label="Karten"
          value={collection.length}
          sub={totalUnits !== collection.length ? `${totalUnits} Exemplare` : null}
        />
        <StatCard
          label="Preisstatus"
          value={loading ? 'Lädt…' : 'Aktuell'}
          sub={lastUpdated ? `${lastUpdated} Uhr` : null}
          highlight={loading ? 'text-slate-500' : 'text-emerald-400'}
        />
      </div>

      {/* Portfolio history chart */}
      {portfolioHistory.length >= 2 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-white mb-4 uppercase tracking-wide">Portfolio-Verlauf</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={portfolioHistory} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ffcb05" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ffcb05" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2f4e" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v.toFixed(0)}€`}
                width={48}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<PortfolioTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#ffcb05"
                strokeWidth={2}
                fill="url(#portfolioGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#ffcb05', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Card list */}
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-2.5 border-b border-border/60">
          <SortHeader label="Karte"     field="name"  sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
          <SortHeader label="Anz."      field="qty"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
          <span className="text-[10px] text-slate-600 uppercase tracking-wide">Zustand</span>
          <span className="text-[10px] text-slate-600 uppercase tracking-wide">Kaufwert</span>
          <SortHeader label="Akt. Wert" field="value" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
          <SortHeader label="Δ"         field="pnl"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
          <span />
        </div>

        <div className="divide-y divide-border/50">
          {sorted.map(entry => (
            <PortfolioRow
              key={entryKey(entry)}
              entry={entry}
              loading={loading}
              onEdit={() => {
                getCard(entry.cardId, entry.lang)
                  .then(c => { setEditCard(c); setEditVariant(entryVariant(entry)); })
                  .catch(() => {});
              }}
            />
          ))}
        </div>
      </div>

      {editCard && (
        <CollectionModal
          card={editCard}
          initialVariant={editVariant}
          onClose={() => setEditCard(null)}
          onSaved={() => { setEditCard(null); getCollection().then(setCollection); }}
        />
      )}
    </div>
  );
}

function PortfolioRow({ entry, loading, onEdit }) {
  const { name, setName, localId, image, imageSmall, lang, qty, condition,
          purchasePrice, purchaseValue, currentPrice, currentValue, pnl, pnlPct } = entry;

  const imgSrc = image ? cardImageSmall(image) : (imageSmall ?? null);
  const pnlColor = pnl == null ? '' : pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="flex md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-surface-3/30 transition-colors group">
      {/* Card info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-10 h-14 flex items-center justify-center">
          {imgSrc ? (
            <img src={imgSrc} alt={name} className="max-h-full max-w-full object-contain" loading="lazy" />
          ) : (
            <div className="w-9 h-12 bg-surface-3/60 rounded border border-border/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-700" viewBox="0 0 40 56" fill="none">
                <rect x="1" y="1" width="38" height="54" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <p className="text-xs text-slate-500 truncate">{setName} · #{localId}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] bg-surface-3/50 text-slate-500 px-1.5 py-0.5 rounded inline-block border border-border/30">
              {(lang ?? 'de').toUpperCase().replace('ZH-TW', 'ZH').replace('ZH-CN', 'ZH')}
            </span>
            {(entry.variant ? entry.variant !== 'normal' : entry.isHolo) && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded inline-block border ${
                (entry.variant ?? 'holo') === 'holo'         ? 'bg-purple-900/50 text-purple-300 border-purple-700/30' :
                (entry.variant) === 'reverse'                ? 'bg-blue-900/50 text-blue-300 border-blue-700/30' :
                (entry.variant) === 'firstEdition'           ? 'bg-amber-900/50 text-amber-300 border-amber-700/30' :
                'bg-slate-800/50 text-slate-300 border-border/40'
              }`}>
                {entry.variant ? (VARIANT_LABELS[entry.variant] ?? entry.variant) : 'Holo'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Qty */}
      <div className="hidden md:block text-sm text-white font-medium">{qty}×</div>

      {/* Condition */}
      <div className="hidden md:block text-xs text-slate-400" title={conditionLabel(condition)}>{condition}</div>

      {/* Purchase value */}
      <div className="hidden md:block">
        {purchaseValue != null ? (
          <div>
            <p className="text-sm text-white font-medium">{formatEur(purchaseValue)}</p>
            <p className="text-xs text-slate-600">{formatEur(purchasePrice)}/St.</p>
          </div>
        ) : (
          <span className="text-sm text-slate-700">–</span>
        )}
      </div>

      {/* Current value */}
      <div className="hidden md:block">
        {loading ? (
          <div className="h-4 w-16 skeleton rounded" />
        ) : currentValue != null ? (
          <div>
            <p className="text-sm text-poke-yellow font-semibold">{formatEur(currentValue)}</p>
            <p className="text-xs text-slate-600">{formatEur(currentPrice)}/St.</p>
          </div>
        ) : (
          <span className="text-sm text-slate-700">–</span>
        )}
      </div>

      {/* P&L */}
      <div className="hidden md:block">
        {loading ? (
          <div className="h-4 w-14 skeleton rounded" />
        ) : pnl != null ? (
          <div className={pnlColor}>
            <p className="text-sm font-semibold">{pnl > 0 ? '+' : ''}{formatEur(pnl)}</p>
            {pnlPct != null && (
              <p className="text-xs opacity-75">{pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%</p>
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-700">–</span>
        )}
      </div>

      {/* Mobile: compact value */}
      <div className="md:hidden ml-auto text-right shrink-0">
        {loading ? (
          <div className="h-4 w-14 skeleton rounded" />
        ) : currentValue != null ? (
          <div>
            <p className="text-sm text-poke-yellow font-semibold">{formatEur(currentValue)}</p>
            {pnlPct != null && (
              <p className={`text-xs ${pnlColor}`}>{pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(1)}%</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Link
          to={`/karte/${entry.lang}/${entry.cardId}`}
          className="p-1.5 text-slate-700 hover:text-white rounded-lg hover:bg-white/5 transition-all"
          title="Karte ansehen"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3-9a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
        </Link>
        <button
          onClick={onEdit}
          className="p-1.5 text-slate-700 hover:text-poke-yellow rounded-lg hover:bg-poke-yellow/5 transition-all"
          title="Bearbeiten"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
