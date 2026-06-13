import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recognizeCard, resizeImageToBase64 } from '../api/aiRecognition';
import { getSettings } from '../data/settings';

const SCAN_STATES = { idle: 'idle', loading: 'loading', result: 'result', error: 'error' };

export default function CardScanModal({ onClose }) {
  const navigate   = useNavigate();
  const [state, setState]     = useState(SCAN_STATES.idle);
  const [preview, setPreview] = useState(null);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [dragging, setDragging] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    getSettings().then(s => setHasApiKey(!!s.aiApiKey));
  }, []);

  const processFile = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) return;
    setState(SCAN_STATES.loading);
    setError('');
    try {
      const base64 = await resizeImageToBase64(file);
      setPreview(`data:image/jpeg;base64,${base64}`);
      const s = await getSettings();
      const r = await recognizeCard(base64, {
        apiKey:  s.aiApiKey  ?? '',
        model:   s.aiModel   ?? 'openai/gpt-4o-mini',
        baseUrl: s.aiBaseUrl ?? '',
      });
      setResult(r);
      setState(SCAN_STATES.result);
    } catch (e) {
      setError(e.message);
      setState(SCAN_STATES.error);
    }
  }, []);

  const onFileChange = (e) => processFile(e.target.files?.[0]);
  const onDrop = (e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files?.[0]); };

  function buildQuery() {
    if (!result) return '';
    const { setAbbr, cardNumber, nameEn, name } = result;
    if (setAbbr && cardNumber) return `${setAbbr} ${cardNumber}`;
    return nameEn || name || '';
  }

  function handleSearch() {
    const q = buildQuery();
    if (!q) return;
    onClose();
    navigate(`/suche?q=${encodeURIComponent(q)}`);
  }

  function handleRetry() { setState(SCAN_STATES.idle); setPreview(null); setResult(null); setError(''); }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-poke-yellow fill-current">
              <path d="M4 5a2 2 0 012-2h8a2 2 0 012 2v1H4V5zm0 3h12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V8zm5 2a1 1 0 100 2 1 1 0 000-2z"/>
            </svg>
            <h2 className="font-bold text-white">KI-Kartenerkennung</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/8">
            <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Upload area */}
          {state !== SCAN_STATES.result && (
            <>
              {/* Preview while loading */}
              {preview && (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img src={preview} alt="Vorschau" className="w-full max-h-52 object-contain" />
                  {state === SCAN_STATES.loading && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-2 border-poke-yellow border-t-transparent rounded-full animate-spin"/>
                      <p className="text-sm text-slate-300">KI analysiert Karte…</p>
                    </div>
                  )}
                </div>
              )}

              {/* Buttons — only in idle (no preview yet) */}
              {!preview && state === SCAN_STATES.idle && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Kamera — capture="environment" öffnet direkt die Rückkamera */}
                  <label htmlFor="scan-camera" className="flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-white/15 hover:border-poke-yellow/40 hover:bg-poke-yellow/5 cursor-pointer transition-all">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    <span className="text-sm font-medium text-slate-300">Kamera</span>
                    <input id="scan-camera" type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
                  </label>

                  {/* Galerie — normaler file picker */}
                  <label htmlFor="scan-gallery"
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
                      ${dragging ? 'border-poke-yellow/60 bg-poke-yellow/5' : 'border-white/15 hover:border-poke-yellow/40 hover:bg-poke-yellow/5'}`}
                  >
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 3v18M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75z" />
                    </svg>
                    <span className="text-sm font-medium text-slate-300">Galerie</span>
                    <input id="scan-gallery" type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                  </label>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {state === SCAN_STATES.error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Result */}
          {state === SCAN_STATES.result && result && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {preview && (
                  <img src={preview} alt="Karte" className="w-20 h-28 object-contain rounded-lg border border-white/10 flex-shrink-0" />
                )}
                <div className="flex-1 space-y-2">
                  <p className="font-bold text-white text-base leading-snug">{result.name}</p>
                  {result.nameEn && result.nameEn !== result.name && (
                    <p className="text-xs text-slate-400">{result.nameEn}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {result.setAbbr    && <span className="text-xs px-2 py-0.5 rounded bg-surface-3 border border-white/10">{result.setAbbr}</span>}
                    {result.cardNumber && <span className="text-xs px-2 py-0.5 rounded bg-surface-3 border border-white/10">#{result.cardNumber}</span>}
                    {result.language   && <span className="text-xs px-2 py-0.5 rounded bg-surface-3 border border-white/10 uppercase">{result.language}</span>}
                    {result.rarity     && <span className="text-xs px-2 py-0.5 rounded bg-surface-3 border border-white/10">{result.rarity}</span>}
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 font-medium
                    ${result.confidence === 'high'   ? 'bg-green-900/40 text-green-400'
                    : result.confidence === 'medium' ? 'bg-yellow-900/40 text-yellow-400'
                                                     : 'bg-red-900/40 text-red-400'}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"/>
                    {result.confidence === 'high' ? 'Hohe Konfidenz' : result.confidence === 'medium' ? 'Mittlere Konfidenz' : 'Niedrige Konfidenz'}
                  </div>
                </div>
              </div>
              <div className="bg-surface-3 rounded-xl p-3 text-xs text-slate-400 font-mono text-center">
                Suchanfrage: <span className="text-slate-200">{buildQuery()}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {(state === SCAN_STATES.result || state === SCAN_STATES.error) && (
              <button onClick={handleRetry} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-surface-3 hover:bg-surface-3/80 text-slate-300 transition-colors border border-white/8">
                Nochmal scannen
              </button>
            )}
            {state === SCAN_STATES.result && buildQuery() && (
              <button onClick={handleSearch} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-poke-yellow text-black hover:bg-poke-yellow/90 transition-colors">
                Karte suchen →
              </button>
            )}
            {(state === SCAN_STATES.idle || state === SCAN_STATES.loading) && (
              <button onClick={onClose} disabled={state === SCAN_STATES.loading} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-surface-3 hover:bg-surface-3/80 text-slate-300 transition-colors border border-white/8 disabled:opacity-40">
                Abbrechen
              </button>
            )}
          </div>

          {/* Hint when no API key */}
          {state === SCAN_STATES.idle && !hasApiKey && (
            <p className="text-xs text-slate-600 text-center">
              Kein API-Key? Unter{' '}
              <strong className="text-slate-500">Verwaltung → KI-Einstellungen</strong>{' '}
              hinterlegen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
