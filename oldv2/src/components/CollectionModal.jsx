import { useState, useEffect } from 'react';
import { cardImageSmall, entryVariant } from '../api/tcgdex';
import { saveCollectionEntry, removeCollectionEntry, getCollectionEntries } from '../data/collection';

export const CONDITIONS = [
  { code: 'M',  label: 'Mint'              },
  { code: 'NM', label: 'Near Mint'         },
  { code: 'LP', label: 'Lightly Played'    },
  { code: 'MP', label: 'Moderately Played' },
  { code: 'HP', label: 'Heavily Played'    },
  { code: 'D',  label: 'Damaged'           },
];

export const VARIANT_LABELS = {
  normal: 'Normal',
  holo: 'Holo',
  reverse: 'Reverse Holo',
  firstEdition: '1. Edition',
};

const VARIANT_ORDER = ['normal', 'holo', 'reverse', 'firstEdition'];

const INPUT = 'w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-poke-red transition-colors';

function buildOptions(cardVariants) {
  const opts = VARIANT_ORDER
    .filter(key => cardVariants[key] === true)
    .map(key => ({ value: key, label: VARIANT_LABELS[key] }));
  return opts.length > 0 ? opts : [
    { value: 'normal', label: VARIANT_LABELS.normal },
    { value: 'holo',   label: VARIANT_LABELS.holo   },
  ];
}

export default function CollectionModal({ card, initialVariant = 'normal', onClose, onSaved }) {
  // Alle Varianten-Einträge dieser Karte – jede Variante ist ein eigener Eintrag
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (card?.id) getCollectionEntries(card.id).then(setEntries);
  }, [card?.id]);

  const variantOptions = buildOptions(card?.variants ?? {});

  function coerce(v) {
    return variantOptions.some(o => o.value === v) ? v : (variantOptions[0]?.value ?? 'normal');
  }

  const [qty, setQty]                     = useState('1');
  const [condition, setCondition]         = useState('NM');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate]   = useState('');
  const [notes, setNotes]                 = useState('');
  const [variant, setVariant]             = useState(() => coerce(initialVariant));

  const existing = entries.find(e => entryVariant(e) === variant) ?? null;

  // Felder beim Laden der Einträge bzw. Wechsel der Variante befüllen
  useEffect(() => {
    if (existing) {
      setQty(String(existing.qty ?? 1));
      setCondition(existing.condition ?? 'NM');
      setPurchasePrice(existing.purchasePrice ?? '');
      setPurchaseDate(existing.purchaseDate ?? '');
      setNotes(existing.notes ?? '');
    } else {
      setQty('1');
      setCondition('NM');
      setPurchasePrice('');
      setPurchaseDate('');
      setNotes('');
    }
  }, [existing]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSave() {
    const qtyNum = Math.max(1, parseInt(qty, 10) || 1);
    await saveCollectionEntry({
      cardId: card.id,
      lang: card._lang ?? 'de',
      name: card.name ?? '',
      setName: card.set?.name ?? '',
      setId: card.set?.id ?? '',
      localId: card.localId ?? '',
      image: card.image ?? null,
      imageSmall: card.imageSmall ?? null,
      qty: qtyNum,
      condition,
      variant,
      isHolo: variant === 'holo',
      purchasePrice: purchasePrice !== '' ? parseFloat(purchasePrice) : null,
      purchaseDate: purchaseDate || null,
      notes: notes.trim() || null,
      addedAt: existing?.addedAt ?? Date.now(),
    });
    onSaved?.();
    onClose();
  }

  async function handleRemove() {
    await removeCollectionEntry(card.id, variant);
    onSaved?.();
    onClose();
  }

  const imgSrc = card?.image ? cardImageSmall(card.image) : (card?.imageSmall ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-surface-2 border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">
            {existing ? 'Sammlung bearbeiten' : 'Zur Sammlung hinzufügen'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Card preview */}
        <div className="flex items-center gap-3 mb-5 bg-surface-3/60 rounded-xl p-3">
          {imgSrc ? (
            <img src={imgSrc} alt={card.name} className="w-12 h-16 object-contain" />
          ) : (
            <div className="w-12 h-16 bg-surface-3 rounded flex items-center justify-center text-slate-600 text-xl">?</div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{card?.name}</p>
            <p className="text-xs text-slate-500 truncate">{card?.set?.name} · #{card?.localId}</p>
            <span className="text-[10px] bg-black/50 text-slate-400 px-1.5 py-0.5 rounded mt-1 inline-block">
              {(card?._lang ?? 'de').toUpperCase().replace('ZH-TW', 'ZH').replace('ZH-CN', 'ZH')}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Variante</label>
              <select
                value={variant}
                onChange={e => setVariant(e.target.value)}
                className={INPUT}
                disabled={variantOptions.length <= 1}
              >
                {variantOptions.map(o => {
                  const inCollection = entries.some(e => entryVariant(e) === o.value);
                  return (
                    <option key={o.value} value={o.value}>
                      {o.label}{inCollection ? ' ✓' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Anzahl</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Zustand</label>
            <select value={condition} onChange={e => setCondition(e.target.value)} className={INPUT}>
              {CONDITIONS.map(c => (
                <option key={c.code} value={c.code}>{c.code} – {c.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Kaufpreis/St. (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                placeholder="–"
                className={INPUT}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Kaufdatum</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Notizen</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional…"
              className={INPUT}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={handleSave}
            className="flex-1 bg-poke-yellow/10 hover:bg-poke-yellow/20 border border-poke-yellow/40 text-poke-yellow rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Speichern
          </button>
          {existing && (
            <button
              onClick={handleRemove}
              className="bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-400 rounded-lg px-3.5 py-2.5 text-sm transition-colors"
              title="Aus Sammlung entfernen"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-500 hover:text-white transition-colors">
            Abbruch
          </button>
        </div>
      </div>
    </div>
  );
}
