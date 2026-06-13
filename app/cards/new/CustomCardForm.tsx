'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Link2, ImageIcon, Upload, X, Download } from 'lucide-react';
import { VARIANTS } from '@/lib/utils';

type FormState = {
  name: string;
  setCodeLabel: string;
  setNameLabel: string;
  localId: string;
  rarity: string;
  category: string;
  variantHint: string;
  imageUrl: string;
  cardmarketUrl: string;
  manualPriceEur: string;
  notes: string;
};

const empty: FormState = {
  name: '',
  setCodeLabel: '',
  setNameLabel: '',
  localId: '',
  rarity: '',
  category: '',
  variantHint: '',
  imageUrl: '',
  cardmarketUrl: '',
  manualPriceEur: '',
  notes: '',
};

type CustomCardFormProps = {
  initialName?: string;
  /** When set, the form edits this card via PATCH instead of creating one. */
  editId?: string;
  /** Prefill values for edit mode. */
  initial?: Partial<FormState> & { cardmarketIdProduct?: number | null };
};

export default function CustomCardForm({ initialName, editId, initial }: CustomCardFormProps) {
  const [form, setForm] = useState<FormState>(() => {
    const { cardmarketIdProduct: _omit, ...rest } = initial ?? {};
    return { ...empty, ...rest, name: rest.name ?? initialName ?? '' };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cmStatus, setCmStatus] = useState<{ tone: 'ok' | 'err' | 'info'; msg: string } | null>(
    null,
  );
  const [cmBusy, setCmBusy] = useState(false);
  // idProduct resolved from a pasted Cardmarket reference — links the custom
  // card to the bulk catalog so it gets daily price updates automatically.
  const [cmIdProduct, setCmIdProduct] = useState<number | null>(initial?.cardmarketIdProduct ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Auto-detect set + number from a pasted Cardmarket URL.
  useEffect(() => {
    const url = form.cardmarketUrl.trim();
    if (!url) return;
    const match = url.match(/-([a-z0-9]+?)(\d{1,4})(?:\/|$)/i);
    if (match) {
      const [, set, number] = match;
      setForm((f) => ({
        ...f,
        setCodeLabel: f.setCodeLabel || set,
        localId: f.localId || number,
      }));
    }
    const nameSegment = url.match(/Singles\/[^/]+\/([^/?#]+)/);
    if (nameSegment && !form.name) {
      const cleaned = decodeURIComponent(nameSegment[1])
        .replace(/-[a-z0-9]+?\d{1,4}$/i, '')
        .replace(/-/g, ' ');
      setForm((f) => (f.name ? f : { ...f, name: cleaned }));
    }
  }, [form.cardmarketUrl]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Upload fehlgeschlagen');
      update('imageUrl', data.url);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setUploading(false);
    }
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  async function fetchCardmarketPrice() {
    setCmStatus(null);
    const input = form.cardmarketUrl.trim();
    if (!input) {
      setCmStatus({ tone: 'err', msg: 'Bitte erst eine Cardmarket-URL, Bild-URL oder idProduct eingeben.' });
      return;
    }
    setCmBusy(true);
    try {
      // 1. Primary path: extract idProduct (image URL / number / ?idProduct=)
      //    and read the price from the synced bulk catalog. No scraping.
      const res = await fetch('/api/cardmarket/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();

      if (data.found) {
        setCmIdProduct(data.idProduct);
        if (data.priceEur != null) update('manualPriceEur', String(data.priceEur));
        // If the user pasted the S3 image URL, use it directly as the card
        // image (most reliable). Otherwise fall back to the reconstructed one.
        const pastedIsImage = /product-images\.s3\.cardmarket\.com/i.test(input);
        setForm((f) => ({
          ...f,
          imageUrl: f.imageUrl || (pastedIsImage ? input : '') || data.imageUrl || '',
          setCodeLabel: f.setCodeLabel || data.setCode || '',
          // Store a clean product-page link (not the pasted image URL) so the
          // "Cardmarket öffnen" link on the detail page works.
          cardmarketUrl: data.productUrl,
        }));
        setCmStatus({
          tone: 'ok',
          msg:
            data.priceEur != null
              ? `Übernommen: ${Number(data.priceEur).toFixed(2)} € · ${data.name} (idProduct ${data.idProduct}, verknüpft)`
              : `Verknüpft: ${data.name} (idProduct ${data.idProduct}) — für diese Karte liegt aktuell kein Bulk-Preis vor.`,
        });
        return;
      }

      // Resolve could not find a product. Prefill anything it parsed from a
      // page URL so the form is at least filled in.
      if (data.setCode || data.cardName || data.cardNumber) {
        setForm((f) => ({
          ...f,
          setCodeLabel: f.setCodeLabel || data.setCode || '',
          localId: f.localId || data.cardNumber || '',
          name: f.name || data.cardName || '',
        }));
      }

      // 2. Fallback: legacy TCGdex/scrape lookup (only meaningful for a URL).
      if (/^https?:\/\//i.test(input)) {
        const res2 = await fetch('/api/cardmarket/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: input }),
        });
        const d2 = await res2.json();
        if (d2.priceEur != null) {
          update('manualPriceEur', String(d2.priceEur));
          setCmStatus({ tone: 'ok', msg: `Übernommen: ${Number(d2.priceEur).toFixed(2)} € (${d2.source})` });
          return;
        }
      }

      setCmStatus({ tone: 'info', msg: data.reason ?? 'Kein Preis gefunden. Bitte manuell eintragen.' });
    } catch (err) {
      setCmStatus({ tone: 'err', msg: String(err) });
    } finally {
      setCmBusy(false);
    }
  }

  const previewName = form.name || 'Karte ohne Namen';
  const previewSet = form.setNameLabel || form.setCodeLabel || 'Set';
  const previewNumber = form.localId || '—';

  const validName = form.name.trim().length > 0;
  const validNumber = form.localId.trim().length > 0;
  const canSubmit = validName && validNumber && !busy;

  async function submit() {
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        localId: form.localId.trim(),
        setCodeLabel: form.setCodeLabel.trim() || null,
        setNameLabel: form.setNameLabel.trim() || null,
        rarity: form.rarity.trim() || null,
        category: form.category.trim() || null,
        variantHint: form.variantHint || null,
        imageUrl: form.imageUrl.trim() || null,
        cardmarketUrl: form.cardmarketUrl.trim() || null,
        notes: form.notes.trim() || null,
        manualPriceEur: form.manualPriceEur ? Number(form.manualPriceEur) : null,
        cardmarketIdProduct: cmIdProduct,
      };
      const res = await fetch(editId ? `/api/custom-cards/${editId}` : '/api/custom-cards', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = data?.error?.fieldErrors;
        const firstIssue = issues ? Object.values(issues).flat()[0] : (data?.error ?? 'Fehler');
        throw new Error(String(firstIssue));
      }
      router.push(`/cards/custom/${editId ?? data.id}`);
      router.refresh();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,18rem] gap-6">
      <div className="surface p-6 space-y-4">
        <Section title="Identifikation">
          <Field label="Name *">
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="z.B. Mewtwo V2"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Set-Code *">
              <input
                className="input w-full"
                value={form.setCodeLabel}
                onChange={(e) => update('setCodeLabel', e.target.value)}
                placeholder="z.B. sv2a"
              />
            </Field>
            <Field label="Nummer *">
              <input
                className="input w-full"
                value={form.localId}
                onChange={(e) => update('localId', e.target.value)}
                placeholder="z.B. 183"
              />
            </Field>
          </div>
          <Field label="Set-Name (optional)">
            <input
              className="input w-full"
              value={form.setNameLabel}
              onChange={(e) => update('setNameLabel', e.target.value)}
              placeholder="z.B. Pokémon Card 151 — Promo"
            />
          </Field>
        </Section>

        <Section title="Metadaten">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Rarität">
              <input
                className="input w-full"
                value={form.rarity}
                onChange={(e) => update('rarity', e.target.value)}
                placeholder="Promo / Holo Rare"
              />
            </Field>
            <Field label="Kategorie">
              <select
                className="input w-full"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
              >
                <option value="">— wählen —</option>
                <option value="Pokemon">Pokémon</option>
                <option value="Trainer">Trainer</option>
                <option value="Energy">Energie</option>
              </select>
            </Field>
            <Field label="Standard-Variante">
              <select
                className="input w-full"
                value={form.variantHint}
                onChange={(e) => update('variantHint', e.target.value)}
              >
                <option value="">— offen lassen —</option>
                {VARIANTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Preise & Referenz">
          <Field
            label={
              <span className="flex items-center gap-2">
                <Link2 className="h-3 w-3 text-flame-400" />
                Cardmarket-URL
              </span>
            }
          >
            <div className="flex gap-2">
              <input
                className="input w-full flex-1"
                value={form.cardmarketUrl}
                onChange={(e) => update('cardmarketUrl', e.target.value)}
                placeholder="Produktseiten-URL, Bild-URL (…s3.cardmarket.com/51/…) oder idProduct"
              />
              <button
                type="button"
                onClick={fetchCardmarketPrice}
                disabled={cmBusy || !form.cardmarketUrl.trim()}
                className="btn btn-ghost text-xs whitespace-nowrap"
                title="Preis von Cardmarket holen (best-effort)"
              >
                {cmBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Preis holen
              </button>
            </div>
            {cmStatus && (
              <div
                className={`text-[11px] mt-1.5 ${
                  cmStatus.tone === 'ok'
                    ? 'text-grass-400'
                    : cmStatus.tone === 'err'
                      ? 'text-flame-400'
                      : 'text-ink-300'
                }`}
              >
                {cmStatus.msg}
              </div>
            )}
            <div className="text-[11px] text-ink-300 mt-1">
              Set-Code &amp; Nummer werden aus der URL erkannt. Für den{' '}
              <strong className="text-ink-200">automatischen Preis</strong> auf Cardmarket
              rechtsklick aufs Kartenbild → „Bildadresse kopieren" und hier einfügen — der
              Bulk-Preis wird übernommen und die Karte dauerhaft verknüpft. (Bulk-Daten vorher
              unter Einstellungen synchronisieren.)
            </div>
          </Field>
          <Field label="Marktpreis in EUR (manuell oder aus Cardmarket)">
            <input
              className="input w-full"
              type="number"
              min="0"
              step="0.01"
              value={form.manualPriceEur}
              onChange={(e) => update('manualPriceEur', e.target.value)}
              placeholder="z.B. 39.90"
            />
          </Field>
        </Section>

        <Section title="Bild & Notizen">
          <Field
            label={
              <span className="flex items-center gap-2">
                <ImageIcon className="h-3 w-3 text-flame-400" />
                Bild (Datei hochladen oder URL einfügen)
              </span>
            }
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative cursor-pointer rounded-lg border-2 border-dashed transition p-4 text-center ${
                dragOver
                  ? 'border-flame-500 bg-flame-500/10'
                  : 'border-white/10 hover:border-white/25 bg-white/[0.02]'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                onChange={onFilePick}
                className="hidden"
              />
              {form.imageUrl ? (
                <div className="flex items-center gap-3 text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt="Vorschau"
                    className="h-16 w-12 object-cover rounded shadow-lg shrink-0 bg-ink-800"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{form.imageUrl}</div>
                    <div className="text-[10px] text-ink-300 mt-0.5">
                      {uploading ? 'lädt…' : 'klick zum Ersetzen oder andere Datei reinziehen'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      update('imageUrl', '');
                    }}
                    className="text-ink-300 hover:text-flame-400"
                    title="Entfernen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-ink-200">
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      lädt hoch…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Upload className="h-4 w-4 text-flame-400" />
                      Datei reinziehen oder klicken
                      <span className="text-ink-300">· png / jpg / webp · max 8 MB</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <input
              className="input w-full mt-2 text-xs"
              value={form.imageUrl}
              onChange={(e) => update('imageUrl', e.target.value)}
              placeholder="… oder Bild-URL einfügen (https://…)"
            />
          </Field>
          <Field label="Notizen">
            <textarea
              className="input w-full min-h-[80px]"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="z.B. Promo aus Sammler-Box, eingeschweißt"
            />
          </Field>
        </Section>

        {error && (
          <div className="text-sm rounded-lg border border-flame-500/40 bg-flame-500/10 text-flame-100 px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={submit} disabled={!canSubmit} className="btn btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {editId ? 'Änderungen speichern' : 'Custom Card speichern'}
          </button>
          <button onClick={() => router.back()} className="btn btn-ghost" disabled={busy}>
            Abbrechen
          </button>
        </div>
      </div>

      {/* live preview */}
      <aside className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.25em] text-flame-400 font-semibold">
          Vorschau
        </div>
        <div className="holo-frame relative overflow-hidden">
          <div className="aspect-[63/88] relative bg-ink-800">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imageUrl}
                alt={previewName}
                className="absolute inset-0 h-full w-full object-cover rounded-[0.75rem]"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-ink-300 p-4 text-center">
                <div>
                  <Sparkles className="h-7 w-7 mx-auto mb-2 text-psychic-400" />
                  <div className="text-sm font-medium text-white">{previewName}</div>
                  <div className="text-xs mt-1 opacity-75">
                    {previewSet} · {previewNumber}
                  </div>
                </div>
              </div>
            )}
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-psychic-500/90 text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-md">
              <Sparkles className="h-3 w-3" />
              custom
            </div>
          </div>
          <div className="px-3 pt-2.5 pb-3">
            <div className="text-sm font-semibold truncate text-white">{previewName}</div>
            <div className="text-[11px] text-ink-300">
              {previewSet} · {previewNumber}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-ink-300 leading-relaxed">
          So sieht deine Karte überall im Portfolio aus. Bild kannst du jederzeit auf der
          Detail-Seite austauschen.
        </p>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-ink-300 font-semibold border-b border-white/5 pb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
