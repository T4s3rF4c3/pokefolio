'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RotateCw,
  Upload,
} from 'lucide-react';

/**
 * Download / restore the local SQLite database. Lives inside Settings.
 *
 * Export pulls a `VACUUM INTO` snapshot of the running DB.
 * Import accepts that same file back and atomically replaces dev.db.
 */
export default function BackupCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [msg, setMsg] = useState<
    | { tone: 'ok' | 'err' | 'info'; text: string; bytes?: number; backup?: string | null }
    | null
  >(null);
  const [confirming, setConfirming] = useState<File | null>(null);

  async function doExport() {
    setBusy('export');
    setMsg(null);
    try {
      const res = await fetch('/api/backup/export');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition') ?? '';
      const m = dispo.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? `pokefolio-${Date.now()}.db`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({
        tone: 'ok',
        text: `Backup heruntergeladen: ${filename}`,
        bytes: blob.size,
      });
    } catch (err) {
      setMsg({ tone: 'err', text: String(err instanceof Error ? err.message : err) });
    } finally {
      setBusy(null);
    }
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) setConfirming(f);
  }

  async function doImport(file: File) {
    setBusy('import');
    setMsg(null);
    setConfirming(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/backup/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setMsg({
        tone: 'ok',
        text: 'Import erfolgreich. Die Seite wird neu geladen…',
        bytes: data.bytes,
        backup: data.backup,
      });
      // Give the user a beat to read the toast, then reload to pick up the
      // freshly mounted database everywhere.
      setTimeout(() => {
        router.refresh();
        window.location.reload();
      }, 1500);
    } catch (err) {
      setMsg({ tone: 'err', text: String(err instanceof Error ? err.message : err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="surface p-5 space-y-4">
      <div>
        <h3 className="font-display text-sm font-semibold">Backup &amp; Restore</h3>
        <p className="text-xs text-ink-300 mt-1 leading-relaxed">
          Lädt einen vollständigen Snapshot der lokalen SQLite-Datenbank herunter (alle Karten,
          Sammlung, Binder, Wishlist, Preise, Cardmarket-Bulk). Beim Import wird die aktuelle
          Datenbank vorher als <code className="text-ink-200">dev.db.bak-…</code> gesichert.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={doExport} disabled={busy != null} className="btn btn-primary text-xs">
          {busy === 'export' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Backup herunterladen
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy != null}
          className="btn btn-ghost text-xs"
        >
          {busy === 'import' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Backup importieren…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".db,.sqlite,application/octet-stream"
          onChange={onFilePick}
          className="hidden"
        />
      </div>

      {confirming && (
        <div className="rounded-lg border border-flame-500/40 bg-flame-500/10 p-3 space-y-2">
          <div className="flex items-start gap-2 text-xs text-flame-100">
            <AlertTriangle className="h-4 w-4 text-flame-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">
                „{confirming.name}" ({(confirming.size / 1024 / 1024).toFixed(1)} MB) importieren?
              </div>
              <div className="text-ink-200 mt-1 leading-relaxed">
                Die aktuelle Datenbank wird komplett überschrieben. Eine Sicherheitskopie der
                jetzigen DB wird automatisch als <code>dev.db.bak-…</code> abgelegt — kannst du
                über das Dateisystem zurückspielen.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => doImport(confirming)}
              className="btn btn-primary text-xs"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Ja, ersetzen
            </button>
            <button
              onClick={() => setConfirming(null)}
              className="btn btn-ghost text-xs"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
            msg.tone === 'ok'
              ? 'border-grass-500/40 bg-grass-500/10 text-grass-100'
              : msg.tone === 'err'
                ? 'border-flame-500/40 bg-flame-500/10 text-flame-100'
                : 'border-white/10 bg-white/[0.03] text-ink-200'
          }`}
        >
          {msg.tone === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 text-grass-400 mt-0.5 shrink-0" />
          ) : msg.tone === 'err' ? (
            <AlertTriangle className="h-4 w-4 text-flame-400 mt-0.5 shrink-0" />
          ) : null}
          <div>
            <div>{msg.text}</div>
            {msg.bytes != null && (
              <div className="text-ink-300 mt-0.5">
                {(msg.bytes / 1024 / 1024).toFixed(2)} MB
                {msg.backup && (
                  <>
                    {' '}
                    · vorherige DB gesichert als{' '}
                    <code className="text-ink-200">{msg.backup}</code>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
