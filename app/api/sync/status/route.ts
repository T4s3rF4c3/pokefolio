import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DAILY_SYNC_MIN_HOURS } from '@/lib/sync';
import { getSchedulerStatus } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/sync/status — a live snapshot the settings "Sync-Center" polls:
 * in-process scheduler state plus the persisted last-sync timestamps and a
 * computed "next due" time so the UI can show whether the background job is
 * healthy and when it will next run.
 */
export async function GET() {
  const [setting, cmSync] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: 1 } }),
    prisma.cardmarketSync.findUnique({ where: { id: 1 } }),
  ]);

  const lastPriceSync = setting?.lastPriceSync ?? null;
  // "Next due" tracks the daily catalog job, which throttles off syncedAt
  // (see runDailySyncIfDue) — not the price-only lastPriceSync.
  const lastDailyRun = cmSync?.syncedAt ?? null;
  const nextDueAt = lastDailyRun
    ? new Date(new Date(lastDailyRun).getTime() + DAILY_SYNC_MIN_HOURS * 60 * 60 * 1000)
    : null;
  const due = !nextDueAt || nextDueAt.getTime() <= Date.now();

  return NextResponse.json({
    scheduler: getSchedulerStatus(),
    minHours: DAILY_SYNC_MIN_HOURS,
    lastPriceSync,
    nextDueAt,
    due,
    cardmarket: cmSync
      ? {
          syncedAt: cmSync.syncedAt,
          catalogAt: cmSync.catalogAt,
          pricesAt: cmSync.pricesAt,
          productsCount: cmSync.productsCount,
          pricesCount: cmSync.pricesCount,
        }
      : null,
  });
}
