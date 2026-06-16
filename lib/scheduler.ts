import { runDailySyncIfDue, type DailySyncOutcome } from '@/lib/sync';

let started = false;

export type SchedulerStatus = {
  /** Whether the scheduler is allowed to run (PRICE_SYNC_ENABLED !== 'false'). */
  enabled: boolean;
  /** Whether startPriceScheduler() has actually run in this process. */
  started: boolean;
  /** Re-check cadence in hours (PRICE_SYNC_INTERVAL_HOURS, default 6). */
  intervalHours: number;
  /** ISO timestamp of when the scheduler booted in this process. */
  startedAt: string | null;
  /** ISO timestamp of the most recent tick (whether or not it ran a sync). */
  lastTickAt: string | null;
  /** ISO timestamp of the last tick that actually performed a sync. */
  lastRunAt: string | null;
  /** Short human-readable result of the last tick. */
  lastOutcome: string | null;
  /** Whether a tick is currently executing. */
  ticking: boolean;
};

// In-process state. Lives for the lifetime of the server process and is shared
// across requests (same module singleton the `started` guard relies on), so the
// settings page can render an accurate picture of the background scheduler.
const state: SchedulerStatus = {
  enabled: process.env.PRICE_SYNC_ENABLED !== 'false',
  started: false,
  intervalHours: Number(process.env.PRICE_SYNC_INTERVAL_HOURS ?? 6) || 6,
  startedAt: null,
  lastTickAt: null,
  lastRunAt: null,
  lastOutcome: null,
  ticking: false,
};

function describeOutcome(outcome: DailySyncOutcome): string {
  if (!outcome.ran) {
    switch (outcome.reason) {
      case 'disabled':
        return 'deaktiviert';
      case 'already-running':
        return 'läuft bereits';
      case 'not-due':
        return 'noch nicht fällig';
    }
  }
  return `aktualisiert: ${outcome.prices.updated}, Fehler: ${outcome.prices.failed}, Katalog: ${outcome.catalog}`;
}

/** Snapshot of the in-process scheduler state for the settings UI / status API. */
export function getSchedulerStatus(): SchedulerStatus {
  return { ...state };
}

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
  state.started = true;
  state.startedAt = new Date().toISOString();

  if (!state.enabled) {
    state.lastOutcome = 'deaktiviert (PRICE_SYNC_ENABLED=false)';
    console.log('[pokefolio] price scheduler disabled (PRICE_SYNC_ENABLED=false)');
    return;
  }

  const intervalMs = state.intervalHours * 60 * 60 * 1000;

  const tick = async () => {
    state.lastTickAt = new Date().toISOString();
    state.ticking = true;
    try {
      const outcome = await runDailySyncIfDue();
      state.lastOutcome = describeOutcome(outcome);
      if (outcome.ran) state.lastRunAt = new Date().toISOString();
    } catch (err) {
      state.lastOutcome = `Fehler: ${String(err instanceof Error ? err.message : err)}`;
      console.error('[pokefolio] scheduled price sync failed:', err);
    } finally {
      state.ticking = false;
    }
  };

  // First catch-up a little after boot so it doesn't compete with startup work.
  const boot = setTimeout(tick, 30_000);
  const timer = setInterval(tick, intervalMs);
  // Don't let the timers keep the process alive on their own.
  boot.unref?.();
  timer.unref?.();

  console.log(`[pokefolio] price scheduler started (every ${state.intervalHours}h)`);
}
