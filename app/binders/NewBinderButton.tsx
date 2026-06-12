'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

const colors = [
  { id: 'flame', label: 'Glut', cls: 'bg-energy-fire' },
  { id: 'water', label: 'Wasser', cls: 'bg-energy-water' },
  { id: 'electric', label: 'Elektro', cls: 'bg-energy-electric' },
  { id: 'psychic', label: 'Psycho', cls: 'bg-energy-psychic' },
  { id: 'grass', label: 'Pflanze', cls: 'bg-energy-grass' },
];

export default function NewBinderButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverColor, setCoverColor] = useState('flame');
  const [pageSize, setPageSize] = useState(9);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/binders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, coverColor, pageSize }),
      });
      if (res.ok) {
        setOpen(false);
        setName('');
        setDescription('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary text-xs">
        <Plus className="h-3.5 w-3.5" />
        Neuer Binder
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur z-50 grid place-items-center px-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface w-full max-w-md p-6 relative"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-ink-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-display text-lg font-bold mb-4">Neuer Binder</h2>

            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input
                  className="input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Holos 151"
                />
              </div>
              <div>
                <label className="label">Beschreibung</label>
                <input
                  className="input w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="label">Cover</label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCoverColor(c.id)}
                      className={`relative h-9 w-16 rounded-md border ${
                        coverColor === c.id
                          ? 'border-white scale-105'
                          : 'border-white/10 hover:border-white/30'
                      } transition ${c.cls}`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Slots pro Seite</label>
                <select
                  className="input w-full"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={4}>4 (2×2)</option>
                  <option value={9}>9 (3×3)</option>
                  <option value={12}>12 (3×4)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setOpen(false)} className="btn btn-ghost flex-1">
                Abbrechen
              </button>
              <button
                onClick={submit}
                disabled={busy || !name.trim()}
                className="btn btn-primary flex-1"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
