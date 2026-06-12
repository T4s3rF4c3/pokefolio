import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCard, extractCardmarketPrices } from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  url: z.string().url(),
});

/**
 * Best-effort Cardmarket price resolver for Custom Cards.
 *
 * Strategy:
 *   1. Parse {setCode}{number} from the slug. If TCGdex happens to have the
 *      same card under that id, use its Cardmarket trend/avg — that's the
 *      cleanest and most reliable path.
 *   2. Otherwise: attempt a server-side fetch of the Cardmarket page and
 *      parse JSON-LD / inline price data. This usually fails because the
 *      product page sits behind Cloudflare bot protection — we return a
 *      clear, honest error so the UI can show "manuell eintragen".
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalide URL' }, { status: 400 });
  }
  const url = parsed.data.url;
  if (!/cardmarket\./i.test(url)) {
    return NextResponse.json({ error: 'Kein Cardmarket-Link' }, { status: 400 });
  }

  // 1. Parse "<set><number>" from the slug tail.
  const slugMatch = url.match(/-([a-z0-9]+?)(\d{1,4})(?:\/|$|\?)/i);
  if (slugMatch) {
    const [, setCode, num] = slugMatch;
    const numVariants = Array.from(
      new Set([num, num.replace(/^0+/, ''), num.padStart(3, '0'), num.padStart(2, '0')]),
    );
    for (const variant of numVariants) {
      const candidateId = `${setCode.toLowerCase()}-${variant}`;
      try {
        const remote = await getCard(candidateId);
        if (remote?.id) {
          const prices = extractCardmarketPrices(remote);
          const eur =
            prices.trendEur ?? prices.avgEur ?? prices.trendHoloEur ?? prices.avgHoloEur;
          if (eur != null) {
            return NextResponse.json({
              priceEur: Number(eur.toFixed(2)),
              source: `TCGdex Cardmarket (${candidateId})`,
            });
          }
        }
      } catch {
        /* try next */
      }
    }
  }

  // 2. Best-effort scrape — usually blocked by Cloudflare.
  const scraped = await tryScrape(url);
  if (scraped.price != null) {
    return NextResponse.json({
      priceEur: Number(scraped.price.toFixed(2)),
      source: `Cardmarket (${scraped.field})`,
    });
  }

  return NextResponse.json({
    priceEur: null,
    reason: scraped.reason,
  });
}

async function tryScrape(url: string): Promise<{
  price: number | null;
  field?: string;
  reason: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        // Plausible browser headers — does not defeat Cloudflare's JS challenge,
        // but doesn't hurt for the small fraction of URLs that aren't gated.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
        Referer: 'https://www.cardmarket.com/',
      },
      // Short timeout — Cloudflare returns the challenge page quickly anyway.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        price: null,
        reason: `Cardmarket antwortete mit ${res.status}. Bitte Preis manuell eintragen.`,
      };
    }
    const html = await res.text();

    if (/challenge-form|cf-challenge|Just a moment|cdn-cgi\/challenge-platform/i.test(html)) {
      return {
        price: null,
        reason:
          'Cardmarket-Seite ist durch Cloudflare geschützt — automatische Abfrage wurde blockiert. Preis bitte manuell eintragen.',
      };
    }

    // Try JSON-LD first.
    const ldMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    for (const m of ldMatches) {
      try {
        const parsed = JSON.parse(m[1]) as Record<string, unknown>;
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const it of items) {
          const offers = (it as Record<string, unknown>).offers as
            | Record<string, unknown>
            | undefined;
          const low = offers && typeof offers.lowPrice !== 'undefined' ? Number(offers.lowPrice) : null;
          if (low && Number.isFinite(low)) {
            return { price: low, field: 'lowPrice', reason: '' };
          }
          const price =
            offers && typeof offers.price !== 'undefined' ? Number(offers.price) : null;
          if (price && Number.isFinite(price)) {
            return { price, field: 'price', reason: '' };
          }
        }
      } catch {
        /* malformed JSON-LD, ignore */
      }
    }

    // Inline pattern often used on Cardmarket: "Available from \€ X.XX" etc.
    const inline = html.match(/(?:Ab|From|Available from|ab)\s*€\s*([\d.,]+)/i);
    if (inline) {
      const price = Number(inline[1].replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(price)) {
        return { price, field: 'priceFromHTML', reason: '' };
      }
    }

    return {
      price: null,
      reason:
        'Konnte den Preis nicht aus der Cardmarket-Seite extrahieren. Bitte manuell eintragen.',
    };
  } catch (err) {
    return {
      price: null,
      reason: `Cardmarket-Abruf fehlgeschlagen (${
        err instanceof Error ? err.message : String(err)
      }). Bitte Preis manuell eintragen.`,
    };
  }
}
