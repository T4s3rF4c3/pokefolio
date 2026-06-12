'use client';

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatEur } from '@/lib/utils';

type Props = {
  data: { capturedAt: string; value: number }[];
  trendDown?: boolean;
  height?: number;
  showAxes?: boolean;
};

export default function PortfolioChart({
  data,
  trendDown = false,
  height = 200,
  showAxes = true,
}: Props) {
  const accent = trendDown ? '#ff4d0a' : '#23b362';
  const accentSoft = trendDown ? '#ff6b1f' : '#5fd28a';

  if (data.length === 0) {
    return (
      <div className="text-xs text-ink-300 py-10 text-center">
        Noch keine Preis-Historie. Tippe oben „Sync" — ein paar Snapshots reichen für
        die erste Kurve.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolio-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showAxes && (
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
        )}
        {showAxes && (
          <XAxis
            dataKey="capturedAt"
            tickFormatter={(d) => {
              const date = new Date(d);
              return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
            }}
            stroke="rgba(255,255,255,0.25)"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
        )}
        {showAxes && (
          <YAxis
            tickFormatter={(n) => formatEur(n).replace(/,00.*$/, '')}
            stroke="rgba(255,255,255,0.25)"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={['dataMin - 1', 'dataMax + 1']}
          />
        )}
        <Tooltip
          contentStyle={{
            background: 'rgba(15, 17, 28, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            fontSize: 12,
            color: 'white',
          }}
          labelFormatter={(d) =>
            new Date(d).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })
          }
          formatter={(v: number) => [formatEur(v), 'Portfolio']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={accentSoft}
          strokeWidth={2}
          fill="url(#portfolio-grad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
