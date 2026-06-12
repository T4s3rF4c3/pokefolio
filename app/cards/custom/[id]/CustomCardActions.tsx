'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

export default function CustomCardActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm('Diese Custom Card und alle Sammlungseinträge wirklich löschen?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/custom-cards/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/collection');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="surface p-2.5 hover:text-flame-300 transition flex items-center justify-center gap-1.5"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      Löschen
    </button>
  );
}
