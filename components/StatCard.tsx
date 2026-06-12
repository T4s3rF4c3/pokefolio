import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'flame' | 'electric' | 'psychic' | 'water' | 'grass';
  className?: string;
};

const accents: Record<NonNullable<Props['accent']>, string> = {
  flame: 'from-flame-500/30 to-transparent text-flame-400',
  electric: 'from-electric-500/30 to-transparent text-electric-400',
  psychic: 'from-psychic-500/30 to-transparent text-psychic-400',
  water: 'from-water-500/30 to-transparent text-water-400',
  grass: 'from-grass-500/30 to-transparent text-grass-400',
};

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'flame',
  className,
}: Props) {
  return (
    <div className={cn('surface relative overflow-hidden p-5', className)}>
      <div
        className={cn(
          'absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-50 bg-gradient-to-br',
          accents[accent],
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-ink-300">{label}</div>
          <div className="font-display text-3xl font-bold mt-2 tracking-tight">{value}</div>
          {hint && <div className="text-xs text-ink-300 mt-1.5">{hint}</div>}
        </div>
        {Icon && (
          <div className={cn('rounded-lg p-2 bg-white/[0.03] border border-white/5', accents[accent].split(' ').slice(-1)[0])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
