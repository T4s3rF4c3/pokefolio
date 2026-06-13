'use client';

import { useState } from 'react';
import { Check, Globe, Loader2, Search, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

type Hit = {
  lang: string;
  id: string;
  name: string;
  image: string;
  rarity: string | null;
};

type LookupResponse = {
  mode: 'id' | 'name';
  hits: Hit[];
  triedIds?: string[];
  query?: string;
};

type Props = {
  setCode: string;
  localId: string;
  /** Initial name to seed the name-search field (typically the card name). */
  defaultName?: string;
  /** Called with the chosen TCGdex image URL (high quality .webp). */
  onPick: (imageUrl: string) => void;
  /** Currently chosen image URL — used to mark which thumbnail is active. */
  currentImageUrl?: string;
};

/**
 * "Find this card on TCGdex" widget used inside the Custom Card form.
 *
 * Two search modes:
 *   • Set + Nummer (auto): probes all languages for a printed (set-code, num).
 *   • Name:               fuzzy text search across all TCGdex languages —
 *                          useful when the same card has different printings
 *                          per language (e.g. EN sv10-102 vs DE drI-195).
 */
export default function TcgdexImageFinder({
  setCode,
  localId,
  defaultName = '',
  onPick,
  currentImageUrl,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);

  const canIdSearch = setCode.trim().length > 0 && localId.trim().length > 0;
  const canNameSearch = name.trim().length >= 2;

  async function run(url: string) {
    setBusy(true);
    setError(null);
    setResp(null);
    try {
      const res = await fetch(url);
      const data = (await res.json()) as LookupResponse & { error?: string };
      if (!res.ok) {
        setError(data?.error ?? 'Lookup fehlgeschlagen');
        return;
      }
      setResp(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  function runIdLookup() {
    run(
      `/api/tcgdex/lookup?set=${encodeURIComponent(setCode.trim())}&local=${encodeURIComponent(
        localId.trim(),
      )}`,
    );
  }
  function runNameLookup() {
    run(`/api/tcgdex/lookup?q=${encodeURIComponent(name.trim())}`);
  }

  // Group hits by card id so we can render one row per matched card and
  // surface its language thumbnails inline.
  const groups = groupByCardId(resp?.hits ?? []);

  return (
    <div className="surface-glass p-3 space-y-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink-300 font-semibold">
        <Globe className="h-3 w-3 text-electric-400" />
        TCGdex-Bild suchen
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runIdLookup}
            disabled={!canIdSearch || busy}
            className="btn btn-ghost text-xs flex-1 justify-center"
            title="Mit Set-Code und Nummer aus dem Formular bei TCGdex prüfen"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Über Set + Nr.
          </button>
          <div className="text-[10px] text-ink-300 font-mono whitespace-nowrap">
            {(setCode || '?')}·{(localId || '?')}
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <Type className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-300" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canNameSearch && !busy) {
                  e.preventDefault();
                  runNameLookup();
                }
              }}
              placeholder="Karten-Name in beliebiger Sprache…"
              className="input w-full pl-8 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={runNameLookup}
            disabled={!canNameSearch || busy}
            className="btn btn-ghost text-xs whitespace-nowrap"
            title="Namen über alle TCGdex-Sprachen suchen"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Name
          </button>
        </div>

        <div className="text-[11px] text-ink-300 leading-relaxed">
          Set + Nr. probiert mehrere ID-Varianten je Sprache. Die Namens-Suche hilft bei
          Karten, deren Set-Code je Sprache unterschiedlich ist (z.B.{' '}
          <span className="font-mono text-ink-200">SV10 102</span> ≠{' '}
          <span className="font-mono text-ink-200">DRI 195</span>).
        </div>
      </div>

      {error && <div className="text-[11px] text-flame-400">{error}</div>}

      {resp && resp.mode === 'id' && groups.length === 0 && (
        <div className="text-[11px] text-ink-300">
          Keine Treffer. Geprüfte IDs:{' '}
          <span className="font-mono text-ink-200">
            {(resp.triedIds ?? []).join(', ') || '—'}
          </span>
          . Wechsle zur Namens-Suche oder lade ein eigenes Bild hoch.
        </div>
      )}
      {resp && resp.mode === 'name' && groups.length === 0 && (
        <div className="text-[11px] text-ink-300">
          Keine Treffer für „{resp.query}" — versuche eine andere Schreibweise oder die
          Originalsprache der Karte.
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-2 space-y-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-white truncate font-medium">{g.name}</div>
                  <div className="text-[10px] text-ink-300 font-mono">{g.id}</div>
                </div>
                <div className="text-[10px] text-ink-300 whitespace-nowrap">
                  {g.langs.length}× Sprache
                </div>
              </div>
              <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-1.5">
                {g.langs.map((h) => {
                  const active = currentImageUrl === h.image;
                  return (
                    <button
                      key={`${h.id}-${h.lang}`}
                      type="button"
                      onClick={() => onPick(h.image)}
                      className={cn(
                        'group relative rounded-md overflow-hidden border transition text-left',
                        active
                          ? 'border-flame-500/60 ring-1 ring-flame-500/50'
                          : 'border-white/10 hover:border-flame-500/40',
                      )}
                      title={`${h.name} — /${h.lang}/`}
                    >
                      <div className="aspect-[63/88] bg-ink-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={h.image}
                          alt={h.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold tracking-wider text-white">
                        {h.lang.toUpperCase()}
                      </div>
                      {active && (
                        <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-flame-500 grid place-items-center shadow-md">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByCardId(hits: Hit[]): { id: string; name: string; langs: Hit[] }[] {
  const map = new Map<string, { id: string; name: string; langs: Hit[] }>();
  for (const h of hits) {
    const g = map.get(h.id);
    if (g) {
      // Keep the first non-id name we see, but prefer one in the user's
      // first matched language (already encoded in array order).
      g.langs.push(h);
    } else {
      map.set(h.id, { id: h.id, name: h.name, langs: [h] });
    }
  }
  return Array.from(map.values());
}
