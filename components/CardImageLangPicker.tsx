'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Image as ImageIcon, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const LANGS: { code: string; label: string }[] = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
  { code: 'it', label: 'IT' },
  { code: 'pt', label: 'PT' },
  { code: 'ja', label: 'JA' },
];

type Props = {
  cardId: string;
  cardLang: string;
  imageLang: string | null;
  hasImage: boolean;
};

/**
 * Compact language picker that re-fetches the card's image from TCGdex under
 * a chosen language. Also supports a manual upload (or pasted URL) for cards
 * that TCGdex has no asset for in any language.
 */
export default function CardImageLangPicker({ cardId, cardLang, imageLang, hasImage }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const active = imageLang ?? cardLang;
  const isCustom = imageLang === 'custom';
  const overridden = imageLang && imageLang !== cardLang;

  async function postBody(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${encodeURIComponent(cardId)}/image-lang`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Bild konnte nicht geladen werden.');
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function pickLang(lang: string | null) {
    if (busy) return;
    await postBody({ lang });
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await up.json();
      if (!up.ok) throw new Error(data?.error ?? 'Upload fehlgeschlagen');
      const ok = await postBody({ imageUrl: data.url });
      if (ok) {
        setShowCustom(false);
        setPasteUrl('');
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = '';
  }

  async function pinUrl() {
    const u = pasteUrl.trim();
    if (!u) return;
    const ok = await postBody({ imageUrl: u });
    if (ok) {
      setShowCustom(false);
      setPasteUrl('');
    }
  }

  return (
    <div className="surface-glass p-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-ink-300">
        <ImageIcon className="h-3 w-3" />
        Bildquelle
        {!hasImage && (
          <span className="pill !text-[9px] !text-flame-400 !border-flame-500/30">
            kein Bild
          </span>
        )}
        {isCustom && (
          <span className="pill !text-[9px] !text-psychic-400 !border-psychic-500/30">
            eigenes Bild
          </span>
        )}
        {overridden && !isCustom && (
          <span className="pill !text-[9px] !text-electric-400 !border-electric-500/30">
            Fallback
          </span>
        )}
        {busy && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
      </div>
      <div className="flex flex-wrap gap-1">
        {LANGS.map((l) => {
          const isActive = !isCustom && l.code === active;
          return (
            <button
              key={l.code}
              onClick={() => pickLang(l.code)}
              disabled={busy}
              title={`Bild aus /${l.code}/ laden`}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide border transition',
                isActive
                  ? 'border-flame-500/40 bg-flame-500/10 text-flame-300'
                  : 'border-white/10 bg-white/[0.02] text-ink-200 hover:bg-white/[0.06] hover:text-white',
                busy && 'opacity-60 cursor-wait',
              )}
            >
              {isActive && <Check className="h-2.5 w-2.5" />}
              {l.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowCustom((v) => !v)}
          disabled={busy}
          title="Eigenes Bild hochladen oder per URL einfügen"
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide border transition',
            isCustom
              ? 'border-psychic-500/40 bg-psychic-500/10 text-psychic-300'
              : 'border-white/10 bg-white/[0.02] text-ink-200 hover:bg-white/[0.06] hover:text-white',
          )}
        >
          {isCustom && <Check className="h-2.5 w-2.5" />}
          <Upload className="h-2.5 w-2.5" />
          Eigenes
        </button>
        {overridden && (
          <button
            onClick={() => pickLang(null)}
            disabled={busy}
            title={`Auf Originalsprache (${cardLang.toUpperCase()}) zurücksetzen`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide border border-white/10 bg-white/[0.02] text-ink-300 hover:text-white hover:bg-white/[0.06] transition"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Reset
          </button>
        )}
      </div>

      {showCustom && (
        <div className="space-y-2 pt-1 border-t border-white/5">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={onFilePick}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn btn-ghost text-xs w-full"
          >
            <Upload className="h-3.5 w-3.5" />
            Datei hochladen · png / jpg / webp
          </button>
          <div className="flex gap-1.5">
            <input
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="… oder Bild-URL einfügen"
              className="input w-full flex-1 text-xs"
            />
            <button
              onClick={pinUrl}
              disabled={busy || !pasteUrl.trim()}
              className="btn btn-primary text-xs whitespace-nowrap"
            >
              Übernehmen
            </button>
          </div>
          <button
            onClick={() => {
              setShowCustom(false);
              setPasteUrl('');
              setError(null);
            }}
            className="text-[10px] text-ink-300 hover:text-white inline-flex items-center gap-1"
          >
            <X className="h-2.5 w-2.5" />
            Schließen
          </button>
        </div>
      )}

      {error && <div className="text-[11px] text-flame-400">{error}</div>}
    </div>
  );
}
