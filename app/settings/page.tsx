import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/PageHeader';
import { formatDate } from '@/lib/utils';
import CardmarketSyncButton from './CardmarketSyncButton';
import BackupCard from './BackupCard';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [settings, cmSync, counts] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: 1 } }),
    prisma.cardmarketSync.findUnique({ where: { id: 1 } }),
    (async () => ({
      cards: await prisma.card.count(),
      customCards: await prisma.customCard.count(),
      sets: await prisma.cardSet.count(),
      collection: await prisma.collectionItem.count(),
      binders: await prisma.binder.count(),
      wishlist: await prisma.wishlistItem.count(),
      cmProducts: await prisma.cardmarketProduct.count(),
      cmPrices: await prisma.cardmarketPrice.count(),
      linkedCards: await prisma.card.count({ where: { cardmarketIdProduct: { not: null } } }),
      linkedCustom: await prisma.customCard.count({
        where: { cardmarketIdProduct: { not: null } },
      }),
    }))(),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Einstellungen"
        title="Konfiguration"
        description="Diese MVP-Version läuft komplett lokal: SQLite-Datei, Prisma-Schema, TCGdex für Karten-Metadaten, Cardmarket Bulk-Drops für Preise."
      />

      <section className="surface p-5 space-y-4">
        <div>
          <h3 className="font-display text-sm font-semibold">Cardmarket Preisdaten</h3>
          <p className="text-xs text-ink-300 mt-1 leading-relaxed">
            Cardmarket veröffentlicht täglich öffentliche JSON-Drops mit Katalog und
            Price-Guide für Pokémon Singles. Wir spiegeln sie lokal und können sie
            direkt mit Karten verknüpfen — kein Cloudflare-Scraping nötig.
          </p>
        </div>
        <CardmarketSyncButton
          productsCount={counts.cmProducts}
          pricesCount={counts.cmPrices}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm pt-2 border-t border-white/5">
          <Pair label="Letzter Sync" value={formatDate(cmSync?.syncedAt ?? null)} />
          <Pair label="Katalog vom" value={formatDate(cmSync?.catalogAt ?? null)} />
          <Pair label="Preise vom" value={formatDate(cmSync?.pricesAt ?? null)} />
          <Pair
            label="Verknüpfte Karten"
            value={`${counts.linkedCards} + ${counts.linkedCustom}`}
          />
        </div>
      </section>

      <section className="surface p-5 space-y-3">
        <h3 className="font-display text-sm font-semibold">TCGdex</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Pair label="Letzter Set-Sync" value={formatDate(settings?.lastFullSync ?? null)} />
          <Pair label="Letzter Preis-Sync" value={formatDate(settings?.lastPriceSync ?? null)} />
        </div>
        <p className="text-xs text-ink-300">
          TCGdex liefert Bilder, Sets, Karten-Metadaten und TCGplayer-USD-Preise.
        </p>
      </section>

      <section className="surface p-5">
        <h3 className="font-display text-sm font-semibold mb-3">Datenbank</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Pair label="Karten (TCGdex)" value={String(counts.cards)} />
          <Pair label="Custom Cards" value={String(counts.customCards)} />
          <Pair label="Sets" value={String(counts.sets)} />
          <Pair label="Sammlungseinträge" value={String(counts.collection)} />
          <Pair label="Binder" value={String(counts.binders)} />
          <Pair label="Wishlist" value={String(counts.wishlist)} />
        </div>
      </section>

      <BackupCard />

      <section className="surface p-5 text-xs text-ink-300 leading-relaxed space-y-2">
        <h3 className="font-display text-sm font-semibold text-white">Hinweise</h3>
        <p>
          Solange eine Karte mit einem Cardmarket-Produkt verknüpft ist, kommt der EUR-Preis
          direkt aus dem täglich gespiegelten Bulk-Katalog. Ohne Verknüpfung greift die
          TCGdex-Cardmarket-Cache (Standard) bzw. der manuelle Preis (bei Custom Cards).
        </p>
        <p>
          Multi-User, Scanner, Achievements und Telegram-Alerts aus dem alten Projekt
          sind bewusst draußen. Lass mich wissen, wenn eines davon zurück soll.
        </p>
      </section>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300">{label}</div>
      <div className="font-display text-base font-semibold text-white">{value}</div>
    </div>
  );
}
