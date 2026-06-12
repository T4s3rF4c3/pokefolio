import { Suspense } from 'react';
import PageHeader from '@/components/PageHeader';
import CustomCardForm from './CustomCardForm';
import { Sparkles, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NewCustomCardPage({
  searchParams,
}: {
  searchParams: { name?: string };
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Custom Card"
        title="Karte manuell anlegen"
        description="Für Karten, die TCGdex (noch) nicht kennt — z.B. Promo-Karten wie sv2a 183 „Mewtwo V2“. Die Karte erscheint überall im Portfolio wie eine normale, ist aber mit einem Custom-Marker gekennzeichnet."
      />

      <div className="surface-glass p-4 text-sm text-ink-200 flex gap-3 items-start">
        <Info className="h-4 w-4 text-flame-400 mt-0.5 shrink-0" />
        <div>
          <strong className="text-white">Tipp:</strong> Wenn du die Cardmarket-URL der
          Karte mitgibst, kannst du später per Klick zur aktuellen Marktpreis-Seite
          springen. Den Preis selbst kannst du manuell pflegen — Auto-Scrape kommt
          später, wenn du das willst.
        </div>
      </div>

      <Suspense>
        <CustomCardForm initialName={searchParams.name} />
      </Suspense>

      <div className="surface p-5 text-xs text-ink-300 flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-psychic-400" />
        Beispiele: <code className="text-flame-300">sv2a 183</code> (Mewtwo V2 Promo
        aus „Pokémon Card 151“), <code className="text-flame-300">SVP 086</code>{' '}
        (Scarlet & Violet Promo).
      </div>
    </div>
  );
}
