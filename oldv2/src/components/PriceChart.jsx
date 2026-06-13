import {
  ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { priceChartData, formatEur } from '../api/tcgdex';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 text-xs">{d.typ}</p>
      <p className="text-poke-yellow font-bold">{formatEur(d.preis)}</p>
    </div>
  );
}

function formatDay(isoDate) {
  const [, m, d] = isoDate.split('-');
  return `${d}.${m}.`;
}

export default function PriceChart({ prices, holoMode = false, history = [] }) {
  const usedPrices = holoMode ? {
    trend: prices.trendHolo,
    avg1: prices.avg1Holo,
    avg7: prices.avg7Holo,
    avg30: prices.avg30Holo,
    market: prices.marketHolo,
    low: prices.lowHolo,
  } : prices;

  // Echte Tages-Snapshots bevorzugen, sobald mindestens 2 Tage vorliegen.
  // Im Holo-Modus nicht nutzbar: Snapshots speichern nur den Hauptpreis.
  const histData = !holoMode
    ? history
        .map(h => ({ label: formatDay(h.date), datum: h.date, preis: h.trend ?? h.avg7 ?? h.avg30, typ: 'Tageswert' }))
        .filter(p => p.preis != null)
    : [];
  const useHistory = histData.length >= 2;

  const data = useHistory ? histData : priceChartData(usedPrices);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
        Nicht genug Preisdaten vorhanden
      </div>
    );
  }

  const values = data.map(d => d.preis).filter(Boolean);
  const min = Math.floor(Math.min(...values) * 0.85);
  const max = Math.ceil(Math.max(...values) * 1.15);
  const trend = usedPrices.trend;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={256}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffcb05" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ffcb05" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[min, max]}
            tickFormatter={(v) => `${v.toFixed(2).replace('.', ',')}€`}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          {trend != null && (
            <ReferenceLine y={trend} stroke="#cc0000" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: 'Trend', fill: '#cc0000', fontSize: 10, position: 'insideTopRight' }} />
          )}
          <Area
            type="monotone"
            dataKey="preis"
            stroke="#ffcb05"
            strokeWidth={2.5}
            fill="url(#priceGrad)"
            dot={{ fill: '#ffcb05', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#ffcb05', stroke: '#0d0d1a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-600 mt-2 text-center">
        {useHistory
          ? `Echte Tagesdaten seit ${data[0].label.replace(/\.$/, '')} · Rote Linie = aktueller Trend`
          : 'Datenpunkte: 30-Tage-, 7-Tage-, 1-Tages-Durchschnitt · Rote Linie = Trend'}
      </p>
    </div>
  );
}
