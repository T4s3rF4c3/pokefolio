import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cardImageUrl, getCard, searchCards } from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';

const LANGS = ['de', 'en', 'fr', 'es', 'it', 'pt', 'ja'] as const;

type Hit = {
  lang: string;
  id: string;
  name: string;
  image: string;
  rarity: string | null;
};

/**
 * GET /api/tcgdex/lookup
 *
 * Two modes (use one):
 *   • ?set=<code>&local=<num>  — probe TCGdex across all languages for that
 *     printed (set-code, number) pair. Used by the Custom Card form when the
 *     user already knows the set + number.
 *   • ?q=<name>                — fuzzy name search across all languages.
 *     Useful when set codes differ between localizations (e.g. an EN-only
 *     printing whose German counterpart sits in a different set entirely),
 *     or when the user doesn't know the printed code.
 *
 * Both modes return a flat `hits` array of (lang, cardId, image) tuples so
 * the UI can group by `id` and surface each available localization as a
 * thumbnail.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const setRaw = (searchParams.get('set') ?? '').trim();
  const localRaw = (searchParams.get('local') ?? '').trim();
  const q = (searchParams.get('q') ?? '').trim();

  if (q) return NextResponse.json(await runNameSearch(q));
  if (setRaw && localRaw) return NextResponse.json(await runIdProbe(setRaw, localRaw));

  return NextResponse.json(
    { error: 'Entweder set+local oder q angeben' },
    { status: 400 },
  );
}

/**
 * Name search.
 *
 * Step 1: ask every language's fuzzy index for the query in parallel. A card
 * usually only matches the language it was searched in (e.g. typing "Perlu"
 * only hits German), so we treat these summaries as *candidate ids*.
 *
 * Step 2: for each unique discovered id, fan out across ALL languages with a
 * direct `cards/{id}` fetch so the user gets every localization that actually
 * exists. Cap the unique-id set to keep "Pikachu" from blowing up.
 */
async function runNameSearch(q: string) {
  const perLang = await Promise.allSettled(LANGS.map((l) => searchCards(q, l)));

  // Collect unique candidate ids and remember the best-known name (we prefer
  // the user's first language if it returned a hit, otherwise whatever came).
  const candidateIds: string[] = [];
  const fallbackName = new Map<string, string>();
  perLang.forEach((res) => {
    if (res.status !== 'fulfilled' || !Array.isArray(res.value)) return;
    for (const c of res.value.slice(0, 10)) {
      if (!c?.id) continue;
      if (!fallbackName.has(c.id)) fallbackName.set(c.id, c.name ?? c.id);
      if (!candidateIds.includes(c.id)) candidateIds.push(c.id);
    }
  });

  // Cap to keep the fan-out bounded. 10 ids × 7 languages = 70 fetches max,
  // all hitting TCGdex's 6h server cache after first probe.
  const ids = candidateIds.slice(0, 10);

  const hits: Hit[] = [];
  await Promise.all(
    ids.flatMap((id) =>
      LANGS.map(async (lang) => {
        try {
          const full = await getCard(id, lang);
          const img = cardImageUrl(full.image, 'high');
          if (!img) return;
          hits.push({
            lang,
            id: full.id,
            name: full.name ?? fallbackName.get(id) ?? id,
            image: img,
            rarity: full.rarity ?? null,
          });
        } catch {
          /* asset/localization just doesn't exist here */
        }
      }),
    ),
  );

  // Sort: stable per id (input order), then by LANGS order within each id.
  const idOrder = new Map(ids.map((id, i) => [id, i]));
  const langOrder = new Map(LANGS.map((l, i) => [l, i]));
  hits.sort(
    (a, b) =>
      (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99) ||
      (langOrder.get(a.lang as (typeof LANGS)[number]) ?? 99) -
        (langOrder.get(b.lang as (typeof LANGS)[number]) ?? 99),
  );

  return {
    mode: 'name' as const,
    query: q,
    hits,
    languagesTried: LANGS.length,
    cardsFound: ids.length,
  };
}

/**
 * (set-code, number) probe — the original mode. Tries several reasonable
 * card-id shapes per language and stops scanning a language as soon as it
 * has a hit.
 */
async function runIdProbe(setRaw: string, localRaw: string) {
  const setCandidates = await collectSetIds(setRaw);
  const localCandidates = collectLocalIds(localRaw);
  const cardIds = unique(
    setCandidates.flatMap((s) => localCandidates.map((l) => `${s}-${l}`)),
  );

  const hits: Hit[] = [];
  const seenLang = new Set<string>();

  for (const lang of LANGS) {
    for (const cardId of cardIds) {
      try {
        const remote = await getCard(cardId, lang);
        const img = cardImageUrl(remote.image, 'high');
        if (img) {
          hits.push({
            lang,
            id: remote.id,
            name: remote.name,
            image: img,
            rarity: remote.rarity ?? null,
          });
          seenLang.add(lang);
          break;
        }
      } catch {
        /* 404: try next candidate */
      }
    }
  }

  return {
    mode: 'id' as const,
    triedIds: cardIds,
    hits,
    languagesTried: LANGS.length,
    languagesFound: seenLang.size,
  };
}

async function collectSetIds(input: string): Promise<string[]> {
  const lower = input.toLowerCase();
  const candidates = new Set<string>([input, lower]);

  const numMatch = lower.match(/^([a-z]+?)(\d+)([a-z]*)$/);
  if (numMatch) {
    const [, prefix, num, suffix] = numMatch;
    const padded = num.padStart(2, '0');
    candidates.add(`${prefix}${padded}`);
    if (suffix) candidates.add(`${prefix}${padded}${suffix}`);
    candidates.add(`${prefix}${Number(num)}`);
  }

  try {
    const localSets = await prisma.cardSet.findMany({
      where: { code: { equals: input } },
      select: { id: true },
    });
    for (const s of localSets) candidates.add(s.id);
  } catch {
    /* ignore */
  }

  return Array.from(candidates);
}

function collectLocalIds(input: string): string[] {
  const trimmed = input.trim();
  const out = new Set<string>([trimmed]);
  if (/^\d+$/.test(trimmed)) {
    out.add(String(Number(trimmed)));
    out.add(trimmed.padStart(3, '0'));
    out.add(trimmed.padStart(2, '0'));
  }
  return Array.from(out);
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
