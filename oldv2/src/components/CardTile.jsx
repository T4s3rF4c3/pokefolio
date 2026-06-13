import { Link } from 'react-router-dom';
import { extractPrices, getPrimaryPrice, priceChange, formatEur, cardImageSmall } from '../api/tcgdex';

const RARITY_BADGE = {
  'Common':      'bg-slate-700/70 text-slate-400',
  'Uncommon':    'bg-green-900/50 text-green-300',
  'Rare':        'bg-blue-900/50 text-blue-300',
  'Rare Holo':   'badge-rare-holo',
  'Rare Ultra':  'badge-rare-ultra',
  'Rare Secret': 'badge-rare-secret',
};

const RARITY_GLOW = {
  'Uncommon':    'glow-uncommon',
  'Rare':        'glow-rare',
  'Rare Holo':   'glow-holo',
  'Rare Ultra':  'glow-ultra',
  'Rare Secret': 'glow-secret',
};

function CardPlaceholder() {
  return (
    <div className="w-[90px] h-[126px] rounded-lg border border-border/40 flex items-center justify-center">
      <svg className="w-10 h-10 text-surface-3" viewBox="0 0 40 56" fill="none">
        <rect x="1" y="1" width="38" height="54" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
        <circle cx="20" cy="24" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <line x1="20" y1="15" x2="20" y2="33" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        <line x1="11" y1="24" x2="29" y2="24" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      </svg>
    </div>
  );
}

export default function CardTile({ card }) {
  const prices = extractPrices(card);
  const price = getPrimaryPrice(prices);
  const change = priceChange(prices);
  const lang = card._lang ?? 'de';

  const rarityBadge = RARITY_BADGE[card.rarity] ?? 'bg-slate-700/70 text-slate-400';
  const glowClass = RARITY_GLOW[card.rarity] ?? '';

  return (
    <Link
      to={`/karte/${lang}/${card.id}`}
      className={`card-shine ${glowClass} group flex flex-col bg-surface-2 border border-border rounded-xl overflow-hidden hover:border-poke-yellow/20 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5`}
    >
      {/* Image area */}
      <div className="relative bg-gradient-to-b from-surface-3 to-surface-2 flex items-center justify-center p-4 h-52">
        {(card.imageSmall || card.image) ? (
          <img
            src={card.imageSmall ?? cardImageSmall(card.image)}
            alt={card.name}
            className="h-full object-contain drop-shadow-lg group-hover:scale-[1.06] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <CardPlaceholder />
        )}

        {/* Source / lang badge */}
        <span className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
          card._source === 'manual'
            ? 'bg-amber-950/90 text-amber-300 border-amber-700/40'
            : card._source === 'ptcgio'
              ? 'bg-sky-950/90 text-sky-300 border-sky-700/40'
              : 'bg-black/55 text-slate-400 border-white/5'
        }`}>
          {(card._lang ?? 'de').toUpperCase().replace('ZH-TW', 'ZH').replace('ZH-CN', 'ZH')}
        </span>
      </div>

      {/* Info area */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-sm font-semibold text-white truncate leading-snug">{card.name}</p>
        <p className="text-[11px] text-slate-500 truncate">
          {card.set?.name ?? '–'} <span className="text-slate-700 mx-0.5">·</span> #{card.localId}
        </p>
        {card.rarity && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full w-fit font-semibold tracking-wide ${rarityBadge}`}>
            {card.rarity}
          </span>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/40">
          <span className={`text-[15px] font-bold ${price ? 'text-poke-yellow' : 'text-slate-600'}`}>
            {formatEur(price)}
          </span>
          {change != null && (
            <span className={`text-[11px] font-semibold ${change > 0 ? 'price-up' : change < 0 ? 'price-down' : 'price-neutral'}`}>
              {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
