import { NextResponse } from 'next/server';
import { runDailySyncIfDue } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/sync/daily — run the full daily refresh (Cardmarket bulk catalog →
 * price history) on demand. This is the same routine the in-process scheduler
 * fires; exposing it lets the settings page trigger a complete sync manually and
 * verify the background job's pipeline end-to-end.
 *
 * Body: { force?: boolean } — force:true ignores the 20h throttle.
 */
export async function POST(req: Request) {
  let force = false;
  try {
    const body = await req.json();
    force = body?.force === true;
  } catch {
    // No/invalid body → default (respect the throttle).
  }

  try {
    const outcome = await runDailySyncIfDue({ force });
    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
