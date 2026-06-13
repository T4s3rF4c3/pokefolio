'use client';

import Link from 'next/link';
import { cn, formatEur } from '@/lib/utils';
import { Sparkles, Wand2 } from 'lucide-react';

type Props = {
  href?: string;
  name: string;
  setLabel?: string | null;
  localId?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
  trendEur?: number | null;
  quantity?: number | null;
  isCustom?: boolean;
  className?: string;
};

/**
 * Premium card tile. Hover: faint holo shimmer and slight lift.
 * The image is hosted by TCGdex (e.g. assets.tcgdex.net) — we let Next/img
 * skip optimization to keep latency low and avoid quality loss on foils.
 */
export default function CardTile({
  href,
  name,
  setLabel,
  localId,
  rarity,
  imageUrl,
  trendEur,
  quantity,
  isCustom,
  className,
}: Props) {
  const inner = (
    <div className={cn('holo-frame lift group', className)}>
      <div className="relative aspect-[63/88] overflow-hidden rounded-[0.75rem] bg-ink-800">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-ink-300 text-xs">
            <div className="text-center px-3">
              <Wand2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <div className="opacity-70">{name}</div>
              <div className="opacity-50 mt-1">{setLabel ?? '—'} · {localId ?? '—'}</div>
            </div>
          </div>
        )}

        {quantity != null && quantity > 0 && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-ink-950/80 backdrop-blur text-[11px] font-bold tracking-wide border border-white/10">
            ×{quantity}
          </div>
        )}
        {isCustom && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-psychic-500/85 text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-md">
            <Sparkles className="h-3 w-3" />
            custom
          </div>
        )}

      </div>

      <div className="px-3 pt-2.5 pb-3">
        <div className="text-sm font-semibold truncate text-white" title={name}>
          {name}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-ink-300">
          <span className="truncate">
            {setLabel ?? '—'} · {localId ?? '—'}
          </span>
          {trendEur != null && (
            <span className="text-white font-semibold shrink-0">{formatEur(trendEur)}</span>
          )}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
