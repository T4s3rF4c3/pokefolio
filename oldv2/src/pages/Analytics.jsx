import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getCollection, getPortfolioHistory, getCardSnapshots } from '../data/collection';

import { formatEur, entryKey } from '../api/tcgdex';

const COLORS = ['#ffcb05', '#f0a500', '#e08a00', '#c97000', '#b05800'];

function SectionHeader({ children }) {
  return (
    <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-3">
      {children}
      <span className="flex-1 h-px bg-white/[0.06]" />
    </h2>
  );
}

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`bg-surface-2 border rounded-xl p-4 ${accent ? 'border-poke-yellow/20' : 'border-border'}`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-poke-yellow' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function MoverRow({ name, setName, change, trend, positive }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-3/30 transition-colors">
      <div className={`w-1.5 h-8 rounded-full shrink-0 ${positive ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{name}</p>
        {setName && <p className="text-xs text-slate-500 truncate">{setName}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-white">{formatEur(trend)}</p>
        <p className={`text-xs font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
          {positive ? '+' : ''}{change.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

const TooltipEur = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d0d1a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-bold text-poke-yellow">{formatEur(payload[0].value)}</p>
    </div>
  );
};

const TooltipCount = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d0d1a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-2xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-bold text-white">{payload[0].value} Karten</p>
    </div>
  );
};

export default function Analytics() {
  const [collection, setCollection]       = useState([]);
  const [portfolioHist, setPortfolioHist] = useState([]);
  const [snapshots, setSnapshots]         = useState({});

  useEffect(() => {
    getCollection().then(c => {
      setCollection(c);
      // Snapshots nur einmal pro Karte laden (Varianten teilen sich die Karte)
      const ids = [...new Set(c.map(e => e.cardId))];
      Promise.all(ids.map(cardId => getCardSnapshots(cardId).then(s => [cardId, s])))
        .then(pairs => setSnapshots(Object.fromEntries(pairs)));
    });
    getPortfolioHistory().then(setPortfolioHist);
  }, []);

  const totalCards  = collection.reduce((s, c) => s + (c.qty ?? 1), 0);
  const uniqueCards = collection.length;

  const trendData = useMemo(() =>
    portfolioHist.slice(-30).map(h => ({ date: h.date.slice(5), value: h.value })),
  [portfolioHist]);

  const latestValue = portfolioHist.at(-1)?.value ?? 0;
  const firstValue  = portfolioHist[0]?.value ?? 0;
  const totalGain   = latestValue - firstValue;

  const setDist = useMemo(() => {
    const counts = {};
    for (const c of collection) {
      const label = c.setName ?? c.set?.name ?? 'Unbekannt';
      counts[label] = (counts[label] ?? 0) + (c.qty ?? 1);
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 17) + '…' : name, count }));
  }, [collection]);

  const { gainers, losers } = useMemo(() => {
    const movers = [];
    const seen = new Set();
    for (const entry of collection) {
      if (seen.has(entry.cardId)) continue; // Bewegung pro Karte, nicht pro Variante
      seen.add(entry.cardId);
      const snaps = snapshots[entry.cardId] ?? [];
      if (snaps.length < 2) continue;
      const first = snaps[0].trend ?? snaps[0].avg7 ?? null;
      const last  = snaps.at(-1).trend ?? snaps.at(-1).avg7 ?? null;
      if (!first || !last || first === 0) continue;
      const pct = ((last - first) / first) * 100;
      movers.push({ cardId: entry.cardId, name: entry.name, setName: entry.setName ?? entry.set?.name, trend: last, change: pct });
    }
    return {
      gainers: movers.filter(m => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
      losers:  movers.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 5),
    };
  }, [collection, snapshots]);

  const duplicates = useMemo(() =>
    collection.filter(c => (c.qty ?? 1) > 1).sort((a, b) => (b.qty ?? 1) - (a.qty ?? 1)),
  [collection]);

  if (collection.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-surface-2 border border-border items-center justify-center mb-5">
          <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-xl font-bold text-white mb-2">Keine Analysedaten</p>
        <p className="text-slate-500 text-sm mb-6">Füge Karten zu deiner Sammlung hinzu, um Analysen zu sehen.</p>
        <Link to="/portfolio" className="inline-flex items-center gap-2 bg-poke-yellow/10 hover:bg-poke-yellow/20 border border-poke-yellow/30 text-poke-yellow rounded-xl px-5 py-2.5 text-sm font-medium transition-colors">
          Zur Sammlung →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 w-full space-y-8 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Analyse</h1>
        <p className="text-xs text-slate-500 mt-1">Überblick über deine Sammlung und Preisentwicklungen</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Sammlungswert"
          value={formatEur(latestValue)}
          sub={portfolioHist.length > 1 ? `${totalGain >= 0 ? '+' : ''}${formatEur(totalGain)} gesamt` : undefined}
          accent
        />
        <StatCard label="Einz. Karten"   value={String(uniqueCards)} sub={`${totalCards} inkl. Duplikate`} />
        <StatCard label="Preis-Gewinner" value={String(gainers.length)} sub="aus deiner Sammlung" />
        <StatCard label="Preis-Verlierer" value={String(losers.length)} sub="aus deiner Sammlung" />
      </div>

      {/* Portfolio trend */}
      {trendData.length >= 2 ? (
        <section>
          <SectionHeader>Portfolio-Verlauf</SectionHeader>
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="w-full h-52">
              <ResponsiveContainer>
                <AreaChart data={trendData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ffcb05" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ffcb05" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2f4e" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} width={50} />
                  <Tooltip content={<TooltipEur />} />
                  <Area type="monotone" dataKey="value" stroke="#ffcb05" strokeWidth={2} fill="url(#portfolioGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      ) : (
        <div className="bg-surface-2 border border-border rounded-xl p-6 text-center text-sm text-slate-500">
          Portfolio-Verlauf wird aufgebaut — täglich aktualisieren um Daten zu sammeln.
        </div>
      )}

      {/* Gainers + Losers */}
      {(gainers.length > 0 || losers.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {gainers.length > 0 && (
            <section>
              <SectionHeader>Größte Gewinner</SectionHeader>
              <div className="bg-surface-2 border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                {gainers.map(m => <MoverRow key={m.cardId} {...m} positive />)}
              </div>
            </section>
          )}
          {losers.length > 0 && (
            <section>
              <SectionHeader>Größte Verlierer</SectionHeader>
              <div className="bg-surface-2 border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                {losers.map(m => <MoverRow key={m.cardId} {...m} positive={false} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Set distribution */}
      {setDist.length > 0 && (
        <section>
          <SectionHeader>Set-Verteilung</SectionHeader>
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="w-full h-52">
              <ResponsiveContainer>
                <BarChart data={setDist} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2f4e" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
                  <Tooltip content={<TooltipCount />} cursor={{ fill: '#ffffff08' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {setDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Duplicates */}
      {duplicates.length > 0 && (
        <section>
          <SectionHeader>Duplikate ({duplicates.length})</SectionHeader>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden divide-y divide-border/60">
            {duplicates.slice(0, 10).map(c => (
              <div key={entryKey(c)} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-3/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{c.name}</p>
                  {(c.setName ?? c.set?.name) && <p className="text-xs text-slate-500 truncate">{c.setName ?? c.set?.name}</p>}
                </div>
                <span className="ml-3 text-xs font-bold bg-surface-3 border border-border px-2.5 py-1 rounded-lg text-slate-300 shrink-0">
                  ×{c.qty ?? 1}
                </span>
              </div>
            ))}
            {duplicates.length > 10 && (
              <p className="px-4 py-2.5 text-xs text-slate-600">+{duplicates.length - 10} weitere</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
