/**
 * Next.js instrumentation hook. `register()` runs once per server process at
 * startup (enabled via experimental.instrumentationHook in next.config.mjs).
 *
 * We use it to start the in-process daily price-sync scheduler so the container
 * keeps prices and portfolio history fresh without any external cron.
 */
export async function register() {
  // Only the Node.js server runtime should run the scheduler (not edge).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startPriceScheduler } = await import('@/lib/scheduler');
  startPriceScheduler();
}
