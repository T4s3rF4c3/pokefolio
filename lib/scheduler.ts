import { runDailySyncIfDue } from '@/lib/sync';

let started = false;

/**
 * Start the in-process daily price-sync scheduler. Idempotent — the module-level
 * guard makes repeat calls (e.g. HMR in dev) no-ops.
 *
 * Runs once shortly after boot (catching up if the last sync is stale) and then
 * on a recurring interval. runDailySyncIfDue() self-throttles via
 * AppSetting.lastPriceSync, so frequent restarts won't trigger redundant heavy
 * Cardmarket catalog downloads.
 *
 * Env knobs:
 *   PRICE_SYNC_ENABLED=false        → disable entirely
 *   PRICE_SYNC_INTERVAL_HOURS=6     → how often to re-check (default 6h)
 */
export function startPriceScheduler() {
  if (started) return;
  started = true;

  if (process.env.PRICE_SYNC_ENABLED === 'false') {
    console.log('[pokefolio] price scheduler disabled (PRICE_SYNC_ENABLED=false)');
    return;
  }

  const intervalHours = Number(process.env.PRICE_SYNC_INTERVAL_HOURS ?? 6) || 6;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  const tick = () => {
    runDailySyncIfDue().catch((err) =>
      console.error('[pokefolio] scheduled price sync failed:', err),
    );
  };

  // First catch-up a little after boot so it doesn't compete with startup work.
  const boot = setTimeout(tick, 30_000);
  const timer = setInterval(tick, intervalMs);
  // Don't let the timers keep the process alive on their own.
  boot.unref?.();
  timer.unref?.();

  console.log(`[pokefolio] price scheduler started (every ${intervalHours}h)`);
}
