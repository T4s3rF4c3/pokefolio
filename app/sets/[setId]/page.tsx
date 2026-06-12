import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import CardTile from '@/components/CardTile';
import EmptyState from '@/components/EmptyState';
import { Layers, Sparkles, ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getSet, cardImageUrl, assetImageUrl, abbreviationOf } from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';

async function ensureSet(setId: string) {
  const cached = await prisma.cardSet.findUnique({
    where: { id: setId },
    include: { cards: { orderBy: { localId: 'asc' } } },
  });
  if (cached && cached.cards.length > 0) return cached;

  try {
    const remote = await getSet(setId);
    await prisma.cardSet.upsert({
      where: { id: setId },
      create: {
        id: remote.id,
        name: remote.name,
        code: abbreviationOf(remote),
        series: remote.serie?.name ?? null,
        releaseDate: remote.releaseDate ? new Date(remote.releaseDate) : null,
        cardCount: remote.cardCount?.official ?? null,
        totalCount: remote.cardCount?.total ?? null,
        logoUrl: assetImageUrl(remote.logo),
        symbolUrl: assetImageUrl(remote.symbol),
      },
      update: {
        name: remote.name,
        code: abbreviationOf(remote),
        series: remote.serie?.name ?? null,
        releaseDate: remote.releaseDate ? new Date(remote.releaseDate) : null,
        cardCount: remote.cardCount?.official ?? null,
        totalCount: remote.cardCount?.total ?? null,
        logoUrl: assetImageUrl(remote.logo),
        symbolUrl: assetImageUrl(remote.symbol),
      },
    });
    for (const c of remote.cards) {
      await prisma.card.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          setId: remote.id,
          localId: c.localId,
          name: c.name,
          imageUrl: cardImageUrl(c.image, 'high'),
          imageUrlSmall: cardImageUrl(c.image, 'low'),
          lang: 'de',
        },
        update: { name: c.name, imageUrl: cardImageUrl(c.image, 'high') },
      });
    }
  } catch {
    /* best effort */
  }
  return prisma.cardSet.findUnique({
    where: { id: setId },
    include: { cards: { orderBy: { localId: 'asc' } } },
  });
}

export default async function SetDetailPage({ params }: { params: { setId: string } }) {
  const set = await ensureSet(params.setId);
  const customCards = await prisma.customCard.findMany({
    where: {
      OR: [{ setId: params.setId }, { setCodeLabel: params.setId }],
    },
    orderBy: { localId: 'asc' },
  });

  if (!set) {
    return (
      <EmptyState
        icon={Layers}
        title="Set nicht gefunden."
        description="Vermutlich existiert dieses Set nicht in TCGdex. Custom Cards können trotzdem unter diesem Set-Code abgelegt werden."
        cta={{ href: '/sets', label: 'Zurück zur Set-Liste' }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/sets"
        className="inline-flex items-center gap-1.5 text-xs text-ink-300 hover:text-white transition"
      >
        <ArrowLeft className="h-3 w-3" />
        Alle Sets
      </Link>

      <div className="surface p-6 flex items-center gap-6 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-flame-500/10 blur-3xl" />
        {set.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={set.logoUrl} alt={set.name} className="h-20 object-contain" />
        )}
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.25em] text-flame-400">
            {set.series ?? 'Set'}
          </div>
          <h2 className="font-display text-2xl font-bold mt-1">{set.name}</h2>
          <div className="text-xs text-ink-300 mt-1">
            {formatDate(set.releaseDate)} · {set.cardCount ?? '—'} offiziell ·{' '}
            {set.totalCount ?? '—'} total · code{' '}
            <code className="text-flame-300">{set.id}</code>
          </div>
        </div>
      </div>

      {customCards.length > 0 && (
        <section>
          <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-psychic-400" />
            Custom Cards in diesem Set
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {customCards.map((c) => (
              <CardTile
                key={c.id}
                href={`/cards/custom/${c.id}`}
                name={c.name}
                setLabel={set.name}
                localId={c.localId}
                imageUrl={c.imageUrl}
                trendEur={c.manualPriceEur}
                isCustom
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-display text-base font-semibold mb-3">Karten</h3>
        {set.cards.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Karten werden geladen…"
            description="Beim ersten Aufruf zieht der Server die Kartenliste aus TCGdex. Lade neu in ein paar Sekunden."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {set.cards.map((c) => (
              <CardTile
                key={c.id}
                href={`/cards/${c.id}`}
                name={c.name}
                setLabel={set.name}
                localId={c.localId}
                rarity={c.rarity}
                imageUrl={c.imageUrl}
                trendEur={c.priceTrendEur ?? c.priceAvgEur}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
