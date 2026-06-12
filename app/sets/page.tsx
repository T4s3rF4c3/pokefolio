import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SyncSetsButton from './SyncSetsButton';
import { Layers } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function SetsPage() {
  // Newest first. SQLite sorts NULLs first by default in DESC; rewrite as a
  // raw orderBy that pushes unknown release dates to the back, then falls back
  // to id (later TCGdex ids are roughly newer).
  const sets = await prisma.cardSet.findMany({
    orderBy: [{ releaseDate: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    include: { _count: { select: { cards: true, customCards: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sets"
        title="Erweiterungen"
        description="Alle Pokémon-Erweiterungen über TCGdex. Klicke ein Set, um Karten zu sehen und schnell zur Sammlung hinzuzufügen."
        actions={<SyncSetsButton />}
      />

      {sets.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Noch keine Sets geladen."
          description="Tippe „Sets synchronisieren“ um die aktuelle Liste aus TCGdex zu laden. Das ist ein einmaliger HTTP-Call."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sets.map((s) => (
            <Link
              key={s.id}
              href={`/sets/${s.id}`}
              className="surface lift p-5 group relative overflow-hidden"
            >
              <div className="absolute inset-x-0 -top-12 h-32 bg-gradient-to-b from-flame-500/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="flex items-start justify-between gap-3 relative">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
                    {s.series ?? 'Serie'}
                  </div>
                  <div className="font-display font-semibold text-base mt-0.5 text-white truncate">
                    {s.name}
                  </div>
                  <div className="text-xs text-ink-300 mt-1">
                    {formatDate(s.releaseDate)} · {s.cardCount ?? '—'} Karten
                  </div>
                </div>
                {(s.logoUrl || s.symbolUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.logoUrl ?? s.symbolUrl ?? ''}
                    alt={s.name}
                    className="h-12 max-w-[140px] object-contain opacity-90 group-hover:opacity-100 transition"
                  />
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-ink-300 relative">
                <span className="font-mono">{s.code ?? s.id}</span>
                <div className="flex items-center gap-2">
                  {s._count.cards > 0 && (
                    <span className="pill !text-xs">{s._count.cards} synced</span>
                  )}
                  {s._count.customCards > 0 && (
                    <span className="pill !text-psychic-400 !border-psychic-500/30">
                      {s._count.customCards} custom
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
