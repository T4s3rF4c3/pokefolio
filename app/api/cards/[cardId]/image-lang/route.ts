import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cardImageUrl, getCard } from '@/lib/tcgdex';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cards/{cardId}/image-lang
 *
 * Three modes, all driven by the JSON body:
 *
 *   1. `{ lang: "en" | "de" | ... }` — refetch from TCGdex under that language
 *      and store its asset URLs.
 *   2. `{ lang: null }` — reset to the card's own `lang` (original asset).
 *   3. `{ imageUrl: "/uploads/abc.png" }` — pin a user-provided image
 *      (uploaded file or external URL). `imageLang` becomes "custom" so the
 *      picker shows a reset chip.
 *
 * Used by CardImageLangPicker on the detail page: lets the user fall back to a
 * different localization, or upload their own scan when no language has an
 * asset.
 */
export async function POST(req: Request, { params }: { params: { cardId: string } }) {
  const body = (await req.json().catch(() => ({}))) as {
    lang?: string | null;
    imageUrl?: string | null;
  };

  const existing = await prisma.card.findUnique({ where: { id: params.cardId } });
  if (!existing) {
    return NextResponse.json({ error: 'Karte nicht gefunden' }, { status: 404 });
  }

  // Custom-image mode: bypass TCGdex entirely.
  if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    const url = body.imageUrl.trim();
    const updated = await prisma.card.update({
      where: { id: params.cardId },
      data: { imageUrl: url, imageUrlSmall: url, imageLang: 'custom' },
    });
    return NextResponse.json({
      ok: true,
      imageLang: updated.imageLang,
      imageUrl: updated.imageUrl,
    });
  }

  const targetLang = body.lang?.trim().toLowerCase() || null;
  const fetchLang = targetLang ?? existing.lang;
  try {
    const remote = await getCard(params.cardId, fetchLang);
    if (!remote?.image) {
      return NextResponse.json(
        { error: `Keine Bild-URL für Sprache "${fetchLang}" gefunden.` },
        { status: 404 },
      );
    }
    const updated = await prisma.card.update({
      where: { id: params.cardId },
      data: {
        imageUrl: cardImageUrl(remote.image, 'high'),
        imageUrlSmall: cardImageUrl(remote.image, 'low'),
        imageLang: targetLang,
      },
    });
    return NextResponse.json({
      ok: true,
      imageLang: updated.imageLang,
      imageUrl: updated.imageUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Sprache "${fetchLang}" nicht verfügbar.`, details: String(err) },
      { status: 404 },
    );
  }
}
