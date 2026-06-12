'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function SyncSetsButton() {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  async function sync() {
    setBusy(true);
    setInfo(null);
    try {
      const res = await fetch('/api/sets/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Fehler');
      setInfo(`+${data.created} · ${data.updated} aktualisiert`);
      router.refresh();
    } catch (err) {
      setInfo(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {info && <span className="text-xs text-ink-300">{info}</span>}
      <button onClick={sync} disabled={busy} className="btn btn-primary text-xs">
        <RefreshCw className={busy ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        Sets synchronisieren
      </button>
    </div>
  );
}
