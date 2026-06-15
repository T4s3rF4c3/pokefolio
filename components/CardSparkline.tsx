'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { formatEur } from '@/lib/utils';

type Props = {
  data: { capturedAt: string; price: number }[];
  trendDown?: boolean;
  height?: number;
};

export default function CardSparkline({ data, trendDown, height = 90 }: Props) {
  if (data.length < 2) {
    return (
      <div className="text-[11px] text-ink-300 py-6 text-center">
        Sparkline füllt sich nach ein paar Preis-Syncs.
      </div>
    );
  }
  const stroke = trendDown ? '#ff4d0a' : '#23b362';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.5} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Hidden, but gives the Tooltip a real category key — without it
            recharts labels each point by its array index, so new Date(index)
            renders every tooltip as "01. Jan" (epoch 1970). */}
        <XAxis dataKey="capturedAt" hide />
        <Tooltip
          contentStyle={{
            background: 'rgba(15, 17, 28, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            fontSize: 11,
            color: 'white',
          }}
          labelFormatter={(d) =>
            new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
          }
          formatter={(v: number) => [formatEur(v), '']}
        />
        <Area type="monotone" dataKey="price" stroke={stroke} strokeWidth={2} fill="url(#spark-grad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
