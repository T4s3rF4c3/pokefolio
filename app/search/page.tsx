'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search as SearchIcon, Sparkles, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import CardTile from '@/components/CardTile';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type CardRow = {
  id: string;
  name: string;
  localId: string;
  imageUrl: string | null;
  rarity: string | null;
  priceTrendEur: number | null;
  priceAvgEur: number | null;
  set: { name: string; code: string | null } | null;
};

type SearchResults = {
  cards: CardRow[];
  customCards: Array<{
    id: string;
    name: string;
    localId: string;
    imageUrl: string | null;
    setCodeLabel: string | null;
    setNameLabel: string | null;
    manualPriceEur: number | null;
  }>;
  remote: Array<{ id: string; name: string; localId: string; imageUrl: string | null }>;
  codeMatch: CardRow | null;
};

export default function SearchPage() {
  const [q, setQ] = useState('');
  const router = useRouter();
  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ['search', q],
    queryFn: async () => {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: q.trim().length >= 2,
  });

  const showHint = !q.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suche"
        title="Karten finden"
        description="Suche nach Name, Set, oder Code (z.B. „mew 183“). Lokale Sammlung wird zuerst gezeigt, danach Live-Treffer aus TCGdex."
        actions={
          <Link href="/cards/new" className="btn btn-ghost text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Custom Card anlegen
          </Link>
        }
      />

      <div className="surface p-4 flex items-center gap-3">
        <SearchIcon className="h-4 w-4 text-ink-300" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="z.B. Charizard, sv2a, 183, Mewtwo …"
          className="bg-transparent outline-none flex-1 text-sm text-white placeholder:text-ink-300"
        />
        {isFetching && <div className="text-[10px] text-ink-300">lädt…</div>}
      </div>

      {showHint && (
        <div className="surface p-8 text-center text-sm text-ink-200 max-w-2xl mx-auto">
          <Sparkles className="h-5 w-5 mx-auto mb-3 text-flame-400" />
          <div className="font-semibold mb-1 text-white">Tipp</div>
          Tippe mindestens 2 Zeichen. Karten, die TCGdex nicht kennt (z.B. Cardmarket-only
          Promos wie <code className="text-flame-300">sv2a 183</code>), kannst du als
          <Link href="/cards/new" className="text-flame-400 hover:underline mx-1">
            Custom Card
          </Link>
          anlegen.
        </div>
      )}

      {data && (
        <>
          {data.codeMatch && (
            <section className="rounded-2xl border border-flame-500/30 bg-flame-500/[0.04] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-[0.25em] text-flame-400 font-semibold">
                  Direkter Treffer · {data.codeMatch.set?.code ?? data.codeMatch.id.split('-')[0].toUpperCase()} {data.codeMatch.localId}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <CardTile
                  href={`/cards/${data.codeMatch.id}`}
                  name={data.codeMatch.name}
                  setLabel={data.codeMatch.set?.name ?? null}
                  localId={data.codeMatch.localId}
                  rarity={data.codeMatch.rarity}
                  imageUrl={data.codeMatch.imageUrl}
                  trendEur={data.codeMatch.priceTrendEur ?? data.codeMatch.priceAvgEur}
                />
              </div>
            </section>
          )}

          {data.cards.length > 0 && (
            <section>
              <h3 className="font-display text-base font-semibold mb-3">
                Bereits in deiner Datenbank
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {data.cards.map((c) => (
                  <CardTile
                    key={c.id}
                    href={`/cards/${c.id}`}
                    name={c.name}
                    setLabel={c.set?.name ?? null}
                    localId={c.localId}
                    rarity={c.rarity}
                    imageUrl={c.imageUrl}
                    trendEur={c.priceTrendEur ?? c.priceAvgEur}
                  />
                ))}
              </div>
            </section>
          )}

          {data.customCards.length > 0 && (
            <section>
              <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
                Deine Custom Cards
                <span className="pill !text-psychic-400 !border-psychic-500/30">manuell</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {data.customCards.map((c) => (
                  <CardTile
                    key={c.id}
                    href={`/cards/custom/${c.id}`}
                    name={c.name}
                    setLabel={c.setNameLabel ?? c.setCodeLabel}
                    localId={c.localId}
                    imageUrl={c.imageUrl}
                    trendEur={c.manualPriceEur}
                    isCustom
                  />
                ))}
              </div>
            </section>
          )}

          {data.remote.length > 0 && (
            <section>
              <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
                Aus TCGdex
                <span className="pill !text-flame-400 !border-flame-500/30">live</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {data.remote.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/cards/${c.id}`)}
                    className="text-left"
                  >
                    <CardTile
                      name={c.name}
                      setLabel={c.id.split('-')[0]}
                      localId={c.localId}
                      imageUrl={c.imageUrl}
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {q.trim().length >= 2 &&
            data.cards.length === 0 &&
            data.customCards.length === 0 &&
            data.remote.length === 0 && (
              <div className="surface p-8 text-center text-sm text-ink-200 max-w-2xl mx-auto">
                <div className="font-semibold mb-1 text-white">Keine Treffer.</div>
                <p className="mt-2">
                  Diese Karte ist anscheinend nirgendwo gelistet. Du kannst sie als
                  Custom Card anlegen — z.B. mit Cardmarket-URL.
                </p>
                <Link
                  href={`/cards/new?name=${encodeURIComponent(q)}`}
                  className="btn btn-primary mt-4 inline-flex text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Als Custom Card anlegen
                </Link>
                <a
                  href={`https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${encodeURIComponent(q)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost mt-4 ml-2 inline-flex text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Auf Cardmarket suchen
                </a>
              </div>
            )}
        </>
      )}
    </div>
  );
}
