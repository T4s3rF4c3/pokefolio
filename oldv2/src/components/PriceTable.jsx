import { formatEur } from '../api/tcgdex';

function Row({ label, value, highlight }) {
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-lg ${highlight ? 'bg-poke-yellow/10' : 'hover:bg-white/3'} transition-colors`}>
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-poke-yellow' : value ? 'text-white' : 'text-slate-600'}`}>
        {formatEur(value)}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function PriceTable({ prices, holoMode = false, showTcg = false }) {
  const trend  = holoMode ? prices.trendHolo  : prices.trend;
  const avg1   = holoMode ? prices.avg1Holo   : prices.avg1;
  const avg7   = holoMode ? prices.avg7Holo   : prices.avg7;
  const avg30  = holoMode ? prices.avg30Holo  : prices.avg30;
  const market = holoMode ? prices.marketHolo : prices.market;
  const low    = holoMode ? prices.lowHolo    : prices.low;

  const hasCardmarket = [trend, avg1, avg7, avg30].some(Boolean);
  const hasTcg = showTcg && [prices.tcgNormalMarket, prices.tcgHoloMarket].some(Boolean);

  if (!hasCardmarket && !hasTcg) {
    return <p className="text-slate-600 text-sm text-center py-4">Keine Preisdaten verfügbar</p>;
  }

  return (
    <div className="space-y-4">
      {hasCardmarket && (
        <Section title={`Cardmarket EUR${holoMode ? ' · Holo' : ''}`}>
          <Row label="Trend" value={trend} highlight />
          <Row label="Ø 1 Tag" value={avg1} />
          <Row label="Ø 7 Tage" value={avg7} />
          <Row label="Ø 30 Tage" value={avg30} />
          <Row label="Marktpreis" value={market} />
          <Row label="Niedrigster Preis" value={low} />
        </Section>
      )}
      {hasTcg && (
        <Section title="TCGPlayer USD">
          <Row label="Markt (Normal)" value={prices.tcgNormalMarket} />
          <Row label="Mid (Normal)" value={prices.tcgNormalMid} />
          <Row label="Low (Normal)" value={prices.tcgNormalLow} />
          {prices.tcgHoloMarket && <Row label="Markt (Holo)" value={prices.tcgHoloMarket} />}
        </Section>
      )}
    </div>
  );
}
