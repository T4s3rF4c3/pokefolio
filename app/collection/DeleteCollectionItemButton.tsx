'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';

type Props = {
  id: string;
  name: string;
};

/**
 * Small overlay button that removes a single collection entry.
 * Rendered as a sibling of the card's <Link> (not a child), so clicking it
 * never triggers navigation. Confirms before deleting to avoid accidents.
 */
export default function DeleteCollectionItemButton({ id, name }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function remove() {
    if (busy) return;
    if (!window.confirm(`„${name}" aus der Sammlung entfernen?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/collection/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Löschen fehlgeschlagen');
      router.refresh();
    } catch (err) {
      window.alert(String(err));
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label={`„${name}" aus der Sammlung entfernen`}
      title="Aus Sammlung entfernen"
      className="absolute top-2 right-2 z-20 grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-ink-950/80 text-ink-200 opacity-0 backdrop-blur transition hover:!text-flame-300 hover:border-flame-500/40 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
