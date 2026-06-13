import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import CustomCardForm from '../../../new/CustomCardForm';

export const dynamic = 'force-dynamic';

export default async function EditCustomCardPage({ params }: { params: { id: string } }) {
  const card = await prisma.customCard.findUnique({ where: { id: params.id } });
  if (!card) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/cards/custom/${card.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-ink-300 hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Zurück zur Karte
      </Link>

      <PageHeader
        eyebrow="Custom Card"
        title={`„${card.name}" bearbeiten`}
        description="Felder anpassen oder über die Cardmarket-Eingabe einen Bulk-Preis neu verknüpfen."
      />

      <CustomCardForm
        editId={card.id}
        initial={{
          name: card.name,
          setCodeLabel: card.setCodeLabel ?? '',
          setNameLabel: card.setNameLabel ?? '',
          localId: card.localId,
          rarity: card.rarity ?? '',
          category: card.category ?? '',
          variantHint: card.variantHint ?? '',
          imageUrl: card.imageUrl ?? '',
          cardmarketUrl: card.cardmarketUrl ?? '',
          manualPriceEur: card.manualPriceEur != null ? String(card.manualPriceEur) : '',
          notes: card.notes ?? '',
          cardmarketIdProduct: card.cardmarketIdProduct,
        }}
      />
    </div>
  );
}
