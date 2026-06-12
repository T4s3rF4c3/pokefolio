import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { BookOpen, Plus } from 'lucide-react';
import NewBinderButton from './NewBinderButton';

export const dynamic = 'force-dynamic';

const accents: Record<string, string> = {
  flame: 'from-flame-500 to-flame-700',
  water: 'from-water-500 to-water-600',
  electric: 'from-electric-500 to-electric-600',
  psychic: 'from-psychic-500 to-psychic-600',
  grass: 'from-grass-500 to-grass-600',
};

export default async function BindersPage() {
  const binders = await prisma.binder.findMany({
    include: { _count: { select: { slots: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Binder"
        title="Virtuelle Binder"
        description="Organisiere Karten visuell wie in einem klassischen Pokémon-Album. Klassisch 3×3, oder eigene Pagegrößen."
        actions={<NewBinderButton />}
      />

      {binders.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Noch kein Binder."
          description="Lege deinen ersten Binder an. Du kannst Karten direkt aus der Sammlung oder als Custom Cards einfügen."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {binders.map((b) => (
            <Link
              key={b.id}
              href={`/binders/${b.id}`}
              className="surface lift relative overflow-hidden p-6 aspect-[5/3] flex flex-col justify-between"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br opacity-30 ${accents[b.coverColor] ?? accents.flame}`}
              />
              <div className="absolute inset-0 bg-dot opacity-30" />

              <div className="relative">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/70">
                  Binder
                </div>
                <h3 className="font-display text-xl font-bold mt-1">{b.name}</h3>
                {b.description && (
                  <p className="text-xs text-white/70 mt-1 line-clamp-2">{b.description}</p>
                )}
              </div>
              <div className="relative flex items-center justify-between text-xs text-white/80">
                <span className="font-mono">{b.pageSize} Slots/Seite</span>
                <span className="pill !text-xs !bg-black/30 !text-white">
                  {b._count.slots} Karten
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
