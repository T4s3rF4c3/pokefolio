import { useState, useEffect } from 'react';
import { LANGS } from '../context/LangContext';
import { saveManualCard, getManualCard, deleteManualCard } from '../data/manualCards';
import { importFromCardmarket, parseCardmarketInput } from '../api/cardmarket';

const PRICE_FIELDS = [
  { key: 'trend', label: 'Trend' },
  { key: 'avg1',  label: '1T-Ø' },
  { key: 'avg7',  label: '7T-Ø' },
  { key: 'avg30', label: '30T-Ø' },
  { key: 'low',   label: 'Niedrig' },
];

export default function ManualCardModal({ abbr = '', number = '', cardId = null, onClose, onSaved }) {
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    if (cardId) getManualCard(cardId).then(e => { if (e) setExisting(e); });
  }, [cardId]);

  const [abbrVal, setAbbrVal]     = useState(abbr.toUpperCase());
  const [numberVal, setNumberVal] = useState(number);
  const [name, setName]           = useState('');
  const [setLabel, setSetLabel]   = useState('');
  const [lang, setLang]           = useState('ja');
  const [imageSmall, setImageSmall] = useState(null);
  const [idProduct, setIdProduct]  = useState(null);
  const [prices, setPrices]       = useState({ trend: '', avg1: '', avg7: '', avg30: '', low: '' });

  // Populate fields once existing entry loads
  useEffect(() => {
    if (!existing) return;
    setAbbrVal(existing._abbr ?? abbr.toUpperCase());
    setNumberVal(existing.localId ?? number);
    setName(existing.name ?? '');
    setSetLabel(existing.set?.name ?? '');
    setLang(existing._lang ?? 'ja');
    setImageSmall(existing.imageSmall ?? null);
    setIdProduct(existing.idProduct ?? null);
    setPrices({
      trend: existing.pricing?.cardmarket?.trend ?? '',
      avg1:  existing.pricing?.cardmarket?.avg1  ?? '',
      avg7:  existing.pricing?.cardmarket?.avg7  ?? '',
      avg30: existing.pricing?.cardmarket?.avg30 ?? '',
      low:   existing.pricing?.cardmarket?.low   ?? '',
    });
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cardmarket import state
  const [cmUrl, setCmUrl]         = useState('');
  const [importState, setImportState] = useState('idle'); // idle | loading | done | error | partial
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [showImport, setShowImport] = useState(!cardId && !abbr);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleImport() {
    const input = cmUrl.trim();
    if (!input) return;
    const parsed = parseCardmarketInput(input);
    if (!parsed) {
      setImportError('Eingabe nicht erkannt. Bitte Bild-URL, idProduct oder Cardmarket-URL einfügen.');
      return;
    }

    setImportState('loading');
    setImportError('');
    setImportPreview(null);

    try {
      const result = await importFromCardmarket(input, abbrVal || null);
      if (result.partial) {
        // Only name/set info from URL, no prices — pre-fill form directly
        setAbbrVal(result.setCode || abbrVal);
        setNumberVal(result.cardNumber || numberVal);
        setName(result.cardName || name);
        setSetLabel(result.setName || setLabel);
        setImportState('partial');
        setImportError('Name und Set übernommen. Für Bild und Preise: Rechtsklick auf das Kartenbild auf Cardmarket → Bildadresse kopieren.');
      } else {
        setImportPreview(result);
        setImportState('done');
      }
    } catch (e) {
      setImportState('error');
      setImportError(e.message ?? 'Unbekannter Fehler');
    }
  }

  function applyImport() {
    if (!importPreview) return;
    setAbbrVal(importPreview.setCode || abbrVal);
    setNumberVal(importPreview.cardNumber || numberVal);
    setName(importPreview.cardName || name);
    setSetLabel(importPreview.setName || setLabel);
    setImageSmall(importPreview.imageUrl ?? null);
    setIdProduct(importPreview.idProduct ?? null);
    if (importPreview.pricing) {
      setPrices({
        trend: importPreview.pricing.trend ?? '',
        avg1:  importPreview.pricing.avg1  ?? '',
        avg7:  importPreview.pricing.avg7  ?? '',
        avg30: importPreview.pricing.avg30 ?? '',
        low:   importPreview.pricing.low   ?? '',
      });
    }
    setImportPreview(null);
    setImportState('idle');
    setCmUrl('');
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageSmall(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const canSave = name.trim() && abbrVal.trim() && numberVal.trim();

  async function handleSave() {
    if (!canSave) return;
    const id = `${abbrVal.toLowerCase()}-${numberVal}`;
    await saveManualCard({
      id,
      _abbr: abbrVal.toUpperCase(),
      _lang: lang,
      name: name.trim(),
      localId: numberVal,
      set: { id: abbrVal.toLowerCase(), name: setLabel.trim() || abbrVal.toUpperCase() },
      image: null,
      imageSmall: imageSmall ?? null,
      imageLarge: null,
      ...(idProduct != null ? { idProduct: Number(idProduct) } : {}),
      pricing: {
        cardmarket: Object.fromEntries(
          PRICE_FIELDS.map(({ key }) => [key, prices[key] !== '' ? parseFloat(prices[key]) : null])
        ),
      },
    });
    onSaved?.(id);
    onClose();
  }

  async function handleDelete() {
    if (!cardId) return;
    await deleteManualCard(cardId);
    onSaved?.(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-surface-2 border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">
            {existing ? 'Karte bearbeiten' : 'Karte manuell hinzufügen'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cardmarket import section */}
        <div className="mb-5">
          <button
            onClick={() => setShowImport(v => !v)}
            className="flex items-center gap-2 w-full text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showImport ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Von Cardmarket importieren
            <span className="text-[10px] bg-blue-900/40 text-blue-400 border border-blue-700/40 px-1.5 py-0.5 rounded ml-1">
              automatisch
            </span>
          </button>

          {showImport && (
            <div className="bg-surface-3/60 border border-border/60 rounded-xl p-4 space-y-3">
              <div className="text-xs text-slate-500 leading-relaxed space-y-1.5">
                <p>Auf Cardmarket die Karte öffnen, dann <strong className="text-slate-400">Rechtsklick auf das Kartenbild → Bildadresse kopieren</strong> und hier einfügen.</p>
                <p className="text-slate-600">Alternativ: idProduct-Nummer aus einem Kauf-Link, oder die Produktseiten-URL.</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={cmUrl}
                  onChange={e => { setCmUrl(e.target.value); setImportState('idle'); setImportError(''); }}
                  placeholder="…s3.cardmarket.com/51/M2A/123456/… oder 123456"
                  className={INPUT + ' flex-1 text-xs'}
                />
                <button
                  onClick={handleImport}
                  disabled={!cmUrl.trim() || importState === 'loading'}
                  className="shrink-0 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/50 text-blue-300 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40"
                >
                  {importState === 'loading' ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                  ) : 'Laden'}
                </button>
              </div>

              {importState === 'error' && (
                <p className="text-xs text-red-400 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  {importError}
                </p>
              )}
              {importState === 'partial' && (
                <p className="text-xs text-amber-400 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {importError}
                </p>
              )}

              {importPreview && (
                <div className="bg-surface-2 border border-blue-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-3">
                    {importPreview.imageUrl && (
                      <img
                        src={importPreview.imageUrl}
                        alt={importPreview.cardName}
                        className="w-10 h-14 object-contain rounded"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{importPreview.cardName}</p>
                      <p className="text-xs text-slate-400">{importPreview.setName} · #{importPreview.cardNumber}</p>
                      <p className="text-xs text-blue-400 font-mono">{importPreview.setCode}</p>
                    </div>
                    {importPreview.pricing?.trend && (
                      <div className="ml-auto text-right shrink-0">
                        <p className="text-xs text-slate-500">Trend</p>
                        <p className="text-sm font-bold text-poke-yellow">{importPreview.pricing.trend.toFixed(2)}€</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={applyImport}
                    className="w-full bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 rounded-lg py-2 text-xs font-medium transition-colors"
                  >
                    Felder übernehmen
                  </button>
                </div>
              )}

              {importState === 'done' && !importPreview && (
                <p className="text-xs text-green-400">✓ Felder wurden übernommen</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kürzel *">
              <input
                value={abbrVal}
                onChange={e => setAbbrVal(e.target.value.toUpperCase())}
                placeholder="M2A"
                className={INPUT}
              />
            </Field>
            <Field label="Nummer *">
              <input
                value={numberVal}
                onChange={e => setNumberVal(e.target.value)}
                placeholder="232"
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Kartenname *">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Mega Dragonite ex"
              className={INPUT}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Set-Name">
              <input
                value={setLabel}
                onChange={e => setSetLabel(e.target.value)}
                placeholder="MEGA Dream ex"
                className={INPUT}
              />
            </Field>
            <Field label="Sprache">
              <select value={lang} onChange={e => setLang(e.target.value)} className={INPUT}>
                {LANGS.map(l => (
                  <option key={l.code} value={l.code}>{l.label} – {l.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Card image */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Kartenbild</p>
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-14 h-[4.5rem] bg-surface-3 rounded-lg border border-border flex items-center justify-center overflow-hidden">
                {imageSmall ? (
                  <img
                    src={imageSmall}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="flex items-center justify-center gap-1.5 w-full bg-surface-3 hover:bg-surface-3/70 border border-border text-slate-400 hover:text-white rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Bild hochladen
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {imageSmall && (
                  <button
                    onClick={() => setImageSmall(null)}
                    className="w-full text-center text-xs text-slate-600 hover:text-red-400 transition-colors py-0.5"
                  >
                    Entfernen
                  </button>
                )}
                <p className="text-[10px] text-slate-700">
                  {imageSmall
                    ? imageSmall.startsWith('data:')
                      ? 'Lokale Datei · wird mit Karte gespeichert'
                      : 'Cardmarket-Bild'
                    : 'PNG, JPG oder WebP · wird lokal gespeichert'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">Cardmarket Preise (EUR)</p>
            <div className="grid grid-cols-3 gap-2">
              {PRICE_FIELDS.map(({ key, label }) => (
                <Field key={key} label={label} small>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prices[key]}
                    onChange={e => setPrices(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="–"
                    className={INPUT}
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 bg-poke-yellow/10 hover:bg-poke-yellow/20 border border-poke-yellow/40 text-poke-yellow rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Speichern
          </button>
          {existing && (
            <button
              onClick={handleDelete}
              className="bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-400 rounded-lg px-4 py-2.5 text-sm transition-colors"
              title="Eintrag löschen"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-500 hover:text-white transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

const INPUT = 'w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-poke-red transition-colors';

function Field({ label, small, children }) {
  return (
    <div>
      <label className={`block mb-1 ${small ? 'text-[10px]' : 'text-xs'} text-slate-500`}>{label}</label>
      {children}
    </div>
  );
}
