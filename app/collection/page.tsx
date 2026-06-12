import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import CardTile from '@/components/CardTile';
import EmptyState from '@/components/EmptyState';
import { Library, Plus, Search } from 'lucide-react';
import { formatEur, formatNumber } from '@/lib/utils';
import {
  buildCardmarketPriceLookup,
  effectiveCardPrice,
  effectiveCustomCardPrice,
} from '@/lib/prices';

export const dynamic = 'force-dynamic';

export default async function CollectionPage() {
  const items = await prisma.collectionItem.findMany({
    include: {
      card: { include: { set: { select: { name: true, code: true } } } },
      customCard: { include: { set: { select: { name: true, code: true } } } },
    },
    orderBy: [{ acquiredAt: 'desc' }],
  });

  const lookup = await buildCardmarketPriceLookup({
    cardIds: items.map((i) => i.card?.cardmarketIdProduct ?? null),
    customCardIds: items.map((i) => i.customCard?.cardmarketIdProduct ?? null),
  });

  const totalCards = items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);
  const totalValue = items.reduce((sum, i) => {
    const trend = i.card
      ? (effectiveCardPrice(i.card, lookup) ?? 0)
      : i.customCard
        ? (effectiveCustomCardPrice(i.customCard, lookup) ?? 0)
        : 0;
    return sum + trend * (i.quantity ?? 1);
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sammlung"
        title={`${formatNumber(totalCards)} Karten`}
        description={`Aktueller Marktwert: ${formatEur(totalValue)}. Klick eine Karte für Details oder ändere Anzahl & Variante direkt am Eintrag.`}
        actions={
          <>
            <Link href="/search" className="btn btn-ghost text-xs">
              <Search className="h-3.5 w-3.5" />
              Karte suchen
            </Link>
            <Link href="/cards/new" className="btn btn-primary text-xs">
              <Plus className="h-3.5 w-3.5" />
              Custom Card
            </Link>
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Deine Sammlung ist leer."
          description="Lege los: suche eine Karte und tippe „Hinzufügen“. Wenn die Karte (z.B. ein Promo) nicht in TCGdex zu finden ist, erstelle sie als Custom Card."
          cta={{ href: '/search', label: 'Karte suchen' }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((it) => {
            const card = it.card ?? it.customCard;
            if (!card) return null;
            const isCustom = !it.card;
            const setLabel =
              it.card?.set?.name ??
              it.customCard?.set?.name ??
              it.customCard?.setNameLabel ??
              it.customCard?.setCodeLabel ??
              null;
            const trend = it.card
              ? effectiveCardPrice(it.card, lookup)
              : it.customCard
                ? effectiveCustomCardPrice(it.customCard, lookup)
                : null;
            return (
              <CardTile
                key={it.id}
                href={isCustom ? `/cards/custom/${it.customCardId}` : `/cards/${it.cardId}`}
                name={card.name}
                setLabel={setLabel}
                localId={card.localId}
                rarity={'rarity' in card ? card.rarity : null}
                imageUrl={card.imageUrl}
                trendEur={trend}
                quantity={it.quantity}
                isCustom={isCustom}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
