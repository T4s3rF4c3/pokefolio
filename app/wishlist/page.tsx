import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import CardTile from '@/components/CardTile';
import { Heart, Search } from 'lucide-react';
import { formatEur } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const items = await prisma.wishlistItem.findMany({
    include: {
      card: { include: { set: true } },
      customCard: { include: { set: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wishlist"
        title="Auf der Jagd"
        description="Karten, die noch fehlen. Setze einen Maximalpreis und behalte den Cardmarket-Wert im Blick."
        actions={
          <Link href="/search" className="btn btn-primary text-xs">
            <Search className="h-3.5 w-3.5" />
            Karte suchen
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Wishlist ist leer."
          description="Suche eine Karte, klick „auf Wishlist“ — fertig."
          cta={{ href: '/search', label: 'Karten suchen' }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((w) => {
            const card = w.card ?? w.customCard;
            if (!card) return null;
            const isCustom = !w.card;
            const trend =
              w.card?.priceTrendEur ??
              w.card?.priceAvgEur ??
              w.customCard?.manualPriceEur ??
              null;
            const hit = w.maxPriceEur != null && trend != null && trend <= w.maxPriceEur;
            return (
              <div key={w.id} className="space-y-2">
                <CardTile
                  href={isCustom ? `/cards/custom/${w.customCardId}` : `/cards/${w.cardId}`}
                  name={card.name}
                  setLabel={w.card?.set?.name ?? w.customCard?.set?.name ?? w.customCard?.setCodeLabel ?? null}
                  localId={card.localId}
                  rarity={'rarity' in card ? card.rarity : null}
                  imageUrl={card.imageUrl}
                  trendEur={trend}
                  isCustom={isCustom}
                />
                {w.maxPriceEur != null && (
                  <div
                    className={`text-[11px] px-2.5 py-1.5 rounded-md border ${
                      hit
                        ? 'bg-grass-500/10 border-grass-500/40 text-grass-400'
                        : 'bg-white/[0.03] border-white/5 text-ink-300'
                    }`}
                  >
                    Ziel: {formatEur(w.maxPriceEur)}
                    {hit && ' · 🎯 erreicht'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
