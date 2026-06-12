import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import { ArrowLeft, BookOpen } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { formatEur } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BinderDetail({ params }: { params: { id: string } }) {
  const binder = await prisma.binder.findUnique({
    where: { id: params.id },
    include: {
      slots: {
        orderBy: { position: 'asc' },
        include: { card: true, customCard: true },
      },
    },
  });

  if (!binder) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Binder nicht gefunden."
        cta={{ href: '/binders', label: 'Zur Binder-Übersicht' }}
      />
    );
  }

  const lastPosition = binder.slots.reduce(
    (m, s) => Math.max(m, s.position),
    -1,
  );
  const totalSlots = Math.max(lastPosition + 1, binder.pageSize);
  const pages = Math.ceil(totalSlots / binder.pageSize);

  const grid: Array<typeof binder.slots[number] | null> = Array(pages * binder.pageSize).fill(null);
  for (const s of binder.slots) grid[s.position] = s;

  const totalValue = binder.slots.reduce((sum, s) => {
    const v = s.card?.priceTrendEur ?? s.card?.priceAvgEur ?? s.customCard?.manualPriceEur ?? 0;
    return sum + v;
  }, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/binders"
        className="inline-flex items-center gap-1.5 text-xs text-ink-300 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Alle Binder
      </Link>

      <PageHeader
        eyebrow="Binder"
        title={binder.name}
        description={binder.description ?? `${binder.slots.length} belegte Slots · Wert ${formatEur(totalValue)}`}
      />

      <div className="space-y-8">
        {Array.from({ length: pages }, (_, page) => {
          const cols = binder.pageSize === 12 ? 3 : binder.pageSize === 4 ? 2 : 3;
          const slots = grid.slice(page * binder.pageSize, (page + 1) * binder.pageSize);
          return (
            <div key={page} className="surface p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[11px] text-ink-300">
                  Seite {page + 1} / {pages}
                </span>
              </div>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {slots.map((slot, i) => {
                  const card = slot?.card ?? slot?.customCard;
                  return (
                    <div
                      key={i}
                      className={
                        card
                          ? 'holo-frame aspect-[63/88] relative overflow-hidden'
                          : 'aspect-[63/88] rounded-xl border border-dashed border-white/10 grid place-items-center text-ink-400 text-[10px] uppercase tracking-widest'
                      }
                    >
                      {card ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageUrl ?? ''}
                          alt={card.name}
                          className="absolute inset-0 h-full w-full object-cover rounded-[0.75rem]"
                        />
                      ) : (
                        <span>leer</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="surface p-5 text-xs text-ink-300">
        Slots kannst du über die API <code className="text-flame-300">POST /api/binders/{binder.id}</code> mit
        Position + cardId/customCardId belegen. Drag &amp; Drop UI folgt — gewollt schlank gehalten.
      </div>
    </div>
  );
}
