'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Loader2,
  Check,
  AlertTriangle,
  Clock,
  Activity,
  Database,
} from 'lucide-react';

export type SchedulerStatus = {
  enabled: boolean;
  started: boolean;
  intervalHours: number;
  startedAt: string | null;
  lastTickAt: string | null;
  lastRunAt: string | null;
  lastOutcome: string | null;
  ticking: boolean;
};

export type SyncStatus = {
  scheduler: SchedulerStatus;
  minHours: number;
  lastPriceSync: string | null;
  nextDueAt: string | null;
  due: boolean;
  cardmarket: {
    syncedAt: string | null;
    catalogAt: string | null;
    pricesAt: string | null;
    productsCount: number;
    pricesCount: number;
  } | null;
};

function formatDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "vor 3 Std", "in 5 Std", "gerade eben" — compact relative time in German. */
function relative(d: string | null): string {
  if (!d) return '—';
  const diffMs = new Date(d).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let unit: string;
  if (mins < 1) return 'gerade eben';
  if (mins < 60) unit = `${mins} Min`;
  else if (hours < 48) unit = `${hours} Std`;
  else unit = `${days} Tg`;
  return diffMs < 0 ? `vor ${unit}` : `in ${unit}`;
}

type ActionResult =
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

export default function SyncCenter({ initial }: { initial: SyncStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>(initial);
  const [busy, setBusy] = useState<null | 'prices' | 'daily'>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/status', { cache: 'no-store' });
      if (res.ok) setStatus(await res.json());
    } catch {
      // Keep the last good status; a transient poll failure isn't worth surfacing.
    }
  }, []);

  // Light polling so a running scheduler tick / countdown stays current without
  // a manual reload. Stops feeling chatty at 20s.
  useEffect(() => {
    const t = setInterval(refreshStatus, 20_000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  async function runPrices() {
    setBusy('prices');
    setResult(null);
    try {
      const res = await fetch('/api/sync/prices', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Fehler');
      setResult({
        kind: 'ok',
        message: `Preise aktualisiert: ${data.updated} (${data.totalCards} Karten, ${data.totalCustom} Custom)${data.failed ? `, ${data.failed} Fehler` : ''}.`,
      });
    } catch (err) {
      setResult({ kind: 'error', message: String(err instanceof Error ? err.message : err) });
    } finally {
      setBusy(null);
      await refreshStatus();
      router.refresh();
    }
  }

  async function runDaily() {
    setBusy('daily');
    setResult(null);
    try {
      const res = await fetch('/api/sync/daily', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Fehler');
      if (data.ran) {
        setResult({
          kind: 'ok',
          message: `Voller Sync fertig — Katalog: ${data.catalog}, Preise aktualisiert: ${data.prices.updated}${data.prices.failed ? `, ${data.prices.failed} Fehler` : ''}.`,
        });
      } else {
        setResult({ kind: 'ok', message: `Übersprungen: ${data.reason}.` });
      }
    } catch (err) {
      setResult({ kind: 'error', message: String(err instanceof Error ? err.message : err) });
    } finally {
      setBusy(null);
      await refreshStatus();
      router.refresh();
    }
  }

  const s = status.scheduler;
  const healthy = s.enabled && s.started;
  const anyBusy = busy !== null || s.ticking;

  return (
    <section className="surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-flame-400" />
            Automatischer Sync
          </h3>
          <p className="text-xs text-ink-300 mt-1 leading-relaxed max-w-prose">
            Ein Scheduler im laufenden Container frischt Katalog &amp; Preise im Hintergrund auf
            (alle {s.intervalHours} Std prüfen, mindestens {status.minHours} Std Abstand). Hier
            siehst du den Status und kannst manuell anstoßen.
          </p>
        </div>
        <StatusBadge healthy={healthy} enabled={s.enabled} ticking={s.ticking} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-white/5 pt-3">
        <Stat
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Letzter Preis-Sync"
          value={formatDateTime(status.lastPriceSync)}
          hint={status.lastPriceSync ? relative(status.lastPriceSync) : undefined}
        />
        <Stat
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Nächster Lauf fällig"
          value={status.due ? 'jetzt fällig' : formatDateTime(status.nextDueAt)}
          hint={!status.due && status.nextDueAt ? relative(status.nextDueAt) : undefined}
          accent={status.due}
        />
        <Stat
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Letzte Prüfung"
          value={formatDateTime(s.lastTickAt)}
          hint={s.lastTickAt ? relative(s.lastTickAt) : 'noch keine'}
        />
        <Stat
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          label="Intervall"
          value={`${s.intervalHours} Std`}
          hint={`min. ${status.minHours} Std Abstand`}
        />
      </div>

      {s.lastOutcome && (
        <div className="text-[11px] text-ink-300 border-t border-white/5 pt-3">
          Letztes Ergebnis: <span className="text-ink-200">{s.lastOutcome}</span>
          {s.lastRunAt && <> · {formatDateTime(s.lastRunAt)}</>}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap border-t border-white/5 pt-3">
        <button onClick={runPrices} disabled={anyBusy} className="btn btn-ghost text-xs">
          {busy === 'prices' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Nur Preise aktualisieren
        </button>
        <button onClick={runDaily} disabled={anyBusy} className="btn btn-primary text-xs">
          {busy === 'daily' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Database className="h-3.5 w-3.5" />
          )}
          Vollen Sync starten
        </button>
        {s.ticking && busy === null && (
          <span className="text-[11px] text-ink-300 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Hintergrund-Sync läuft gerade…
          </span>
        )}
      </div>

      {result && (
        <div
          className={`text-xs flex items-start gap-1.5 ${
            result.kind === 'ok' ? 'text-grass-400' : 'text-flame-400'
          }`}
        >
          {result.kind === 'ok' ? (
            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}

      {!s.enabled && (
        <div className="text-[11px] text-amber-300/90 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Der Scheduler ist per <code>PRICE_SYNC_ENABLED=false</code> deaktiviert. Manuelle
          Buttons funktionieren weiterhin.
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  healthy,
  enabled,
  ticking,
}: {
  healthy: boolean;
  enabled: boolean;
  ticking: boolean;
}) {
  const label = ticking ? 'läuft' : !enabled ? 'deaktiviert' : healthy ? 'aktiv' : 'inaktiv';
  const color = ticking
    ? 'text-sky-300 border-sky-500/30 bg-sky-500/[0.07]'
    : !enabled
      ? 'text-amber-300 border-amber-500/30 bg-amber-500/[0.07]'
      : healthy
        ? 'text-grass-400 border-grass-500/30 bg-grass-500/[0.07]'
        : 'text-ink-300 border-white/10 bg-white/[0.03]';
  return (
    <span
      className={`pill ${color} !text-[0.7rem]`}
      title={healthy ? 'Scheduler läuft in diesem Container' : 'Scheduler nicht gestartet'}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ticking
            ? 'bg-sky-400 animate-pulse'
            : healthy
              ? 'bg-grass-400'
              : enabled
                ? 'bg-ink-300'
                : 'bg-amber-400'
        }`}
      />
      {label}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-300 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={`font-display text-sm font-semibold mt-0.5 ${
          accent ? 'text-flame-400' : 'text-white'
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-ink-300 mt-0.5">{hint}</div>}
    </div>
  );
}
