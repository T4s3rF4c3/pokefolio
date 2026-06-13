'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Heart } from 'lucide-react';
import { CONDITIONS, VARIANTS, LANGUAGES } from '@/lib/utils';

type Props = {
  cardId?: string;
  customCardId?: string;
};

export default function AddToCollectionForm({ cardId, customCardId }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('NM');
  const [variant, setVariant] = useState('Normal');
  const [language, setLanguage] = useState('de');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  async function add() {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          customCardId,
          quantity,
          condition,
          variant,
          language,
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        }),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern');
      setToast('✓ Hinzugefügt');
      setQuantity(1);
      setPurchasePrice('');
      router.refresh();
    } catch (err) {
      setToast(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function wish() {
    setBusy(true);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, customCardId }),
      });
      if (res.ok) {
        setToast('✓ Auf Wishlist');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
      <div>
        <label className="label">Anzahl</label>
        <input
          type="number"
          min={1}
          max={999}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          className="input w-full"
        />
      </div>
      <div>
        <label className="label">Zustand</label>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="input w-full"
        >
          {CONDITIONS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Variante</label>
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          className="input w-full"
        >
          {VARIANTS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Sprache</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="input w-full"
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">EK €</label>
        <input
          type="number"
          step="0.01"
          min={0}
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="optional"
          className="input w-full"
        />
      </div>

      <div className="col-span-2 xs:col-span-3 sm:col-span-5 flex flex-wrap gap-2 pt-1">
        <button onClick={add} disabled={busy} className="btn btn-primary text-sm flex-1 min-w-[160px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Hinzufügen
        </button>
        <button onClick={wish} disabled={busy} className="btn btn-ghost text-sm">
          <Heart className="h-4 w-4" />
          <span className="hidden xs:inline">Auf Wishlist</span>
          <span className="xs:hidden">Wishlist</span>
        </button>
        {toast && <span className="text-xs text-ink-200 self-center ml-2 w-full xs:w-auto">{toast}</span>}
      </div>
    </div>
  );
}
