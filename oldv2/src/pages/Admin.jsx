import { useState, useMemo, useEffect, useCallback } from 'react';
import { getAllManualCards, saveManualCard, deleteManualCard } from '../data/manualCards';
import { loadPriceGuide } from '../api/cardmarket';
import { getCollection, getPortfolioHistory } from '../data/collection';
import { formatEur } from '../api/tcgdex';
import ManualCardModal from '../components/ManualCardModal';
import { MODELS, recognizeCard, resizeImageToBase64 } from '../api/aiRecognition';
import { getSettings, saveSettings } from '../data/settings';

const LS_KEYS = {
  manualCards:      'pokeprice_manual_cards',
  collection:       'pokeprice_collection',
  cardSnapshots:    'pokeprice_card_snapshots',
  portfolioHistory: 'pokeprice_portfolio_history',
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function lsBytes(key) {
  return new Blob([localStorage.getItem(key) ?? '']).size;
}

export default function Admin() {
  const [cards, setCards]             = useState([]);
  const [editId, setEditId]           = useState(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [bulkState, setBulkState]     = useState('idle'); // idle | loading | done | error
  const [bulkMsg, setBulkMsg]         = useState('');
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [confirmClear, setConfirmClear] = useState(null);
  const [storageVersion, setStorageVersion] = useState(0);

  const [collection, setCollection]       = useState([]);
  const [portfolioHist, setPortfolioHist] = useState([]);

  // AI settings
  const [aiSettings, setAiSettings] = useState({});
  const [aiTestState, setAiTestState] = useState('idle'); // idle | loading | ok | error
  const [aiTestMsg, setAiTestMsg]   = useState('');

  async function saveAi(patch) {
    const next = await saveSettings(patch);
    setAiSettings(next);
  }

  async function testAiKey() {
    setAiTestState('loading');
    setAiTestMsg('');
    try {
      const url = (aiSettings.aiBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/models';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${aiSettings.aiApiKey ?? ''}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAiTestState('ok');
      setAiTestMsg('Verbindung erfolgreich');
    } catch (e) {
      setAiTestState('error');
      setAiTestMsg(e.message);
    }
  }

  const reload = useCallback(() => {
    getAllManualCards().then(all => setCards(Object.values(all)));
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { getSettings().then(setAiSettings); }, []);
  useEffect(() => {
    getCollection().then(setCollection);
    getPortfolioHistory().then(setPortfolioHist);
  }, [storageVersion]);

  const withCmId = cards.filter(c => c.idProduct).length;

  // --- Bulk price refresh ---
  async function handleBulkRefresh() {
    const targets = cards.filter(c => c.idProduct);
    if (!targets.length) return;
    setBulkState('loading');
    setBulkMsg('');
    setBulkProgress({ done: 0, total: targets.length });
    try {
      const guide = await loadPriceGuide();
      let updated = 0;
      const now = new Date().toISOString();
      for (const card of targets) {
        const p = guide.get(Number(card.idProduct));
        if (p) {
          await saveManualCard({
            ...card,
            pricing: {
              cardmarket: {
                trend: p.trend ?? null,
                avg1:  p.avg1  ?? null,
                avg7:  p.avg7  ?? null,
                avg30: p.avg30 ?? null,
                low:   p.low   ?? null,
              },
            },
            _pricesUpdatedAt: now,
          });
          updated++;
        }
        setBulkProgress({ done: updated, total: targets.length });
      }
      reload();
      setBulkState('done');
      setBulkMsg(`${updated} von ${targets.length} Karten aktualisiert`);
    } catch (e) {
      setBulkState('error');
      setBulkMsg(e.message ?? 'Fehler beim Laden des Preisguide');
    }
  }

  // --- Single card refresh ---
  async function refreshCard(card) {
    if (!card.idProduct) return;
    const guide = await loadPriceGuide();
    const p = guide.get(Number(card.idProduct));
    if (!p) return;
    await saveManualCard({
      ...card,
      pricing: {
        cardmarket: {
          trend: p.trend ?? null,
          avg1:  p.avg1  ?? null,
          avg7:  p.avg7  ?? null,
          avg30: p.avg30 ?? null,
          low:   p.low   ?? null,
        },
      },
      _pricesUpdatedAt: new Date().toISOString(),
    });
    reload();
  }

  // --- Export ---
  async function handleExport() {
    const res = await fetch('/api/backup');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokeprice-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Import ---
  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) throw new Error('Keine gültige Backup-Datei');
        const res = await fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setStorageVersion(v => v + 1);
        reload();
        alert(`Backup vom ${data.exportedAt?.slice(0, 10) ?? '?'} importiert.`);
      } catch {
        alert('Ungültige Backup-Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // --- Clear ---
  const CLEAR_ENDPOINTS = {
    manualCards:      '/api/manual-cards',
    collection:       '/api/collection',
    cardSnapshots:    '/api/snapshots',
    portfolioHistory: '/api/portfolio',
  };

  async function handleClear(key) {
    await fetch(CLEAR_ENDPOINTS[key], { method: 'DELETE' });
    setConfirmClear(null);
    setStorageVersion(v => v + 1);
    reload();
  }

  // storageVersion ensures all storage stats refresh after any clear/import
  const storageStats = useMemo(() => ({
    manualCards: cards.length,
    collection: collection.length,
    portfolioHistory: portfolioHist.length,
  }), [cards, collection, portfolioHist, storageVersion]);

  const bulkPct = bulkProgress.total > 0
    ? Math.round((bulkProgress.done / bulkProgress.total) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 w-full space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Verwaltung</h1>
        <p className="text-xs text-slate-500 mt-1">Datenpflege, Preisaktualiserung und Backup</p>
      </div>

      {/* ── Manuelle Karten ── */}
      <section>
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Manuelle Karten</h2>
            <p className="text-xs text-slate-500">
              {cards.length} {cards.length === 1 ? 'Eintrag' : 'Einträge'}
              {' · '}
              {withCmId} mit Cardmarket-ID
              {withCmId < cards.length && cards.length > 0 && (
                <span className="text-amber-600 ml-1">
                  ({cards.length - withCmId} ohne CM-ID — kein Auto-Refresh möglich)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bulkState === 'done'  && <span className="text-xs text-green-400">{bulkMsg}</span>}
            {bulkState === 'error' && <span className="text-xs text-red-400">{bulkMsg}</span>}
            <button
              onClick={() => setShowNewCard(true)}
              className="flex items-center gap-1.5 bg-poke-yellow/10 hover:bg-poke-yellow/20 border border-poke-yellow/30 text-poke-yellow rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neue Karte
            </button>
            <button
              onClick={handleBulkRefresh}
              disabled={withCmId === 0 || bulkState === 'loading'}
              className="flex items-center gap-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {bulkState === 'loading' ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Alle aktualisieren
            </button>
          </div>
        </div>

        {/* Bulk progress bar */}
        {bulkState === 'loading' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Aktualisiere Preise…</span>
              <span>{bulkProgress.done} / {bulkProgress.total}</span>
            </div>
            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${bulkPct}%` }}
              />
            </div>
          </div>
        )}

        {cards.length === 0 ? (
          <div className="bg-surface-2 border border-border rounded-xl p-10 text-center">
            <p className="text-slate-500 text-sm">
              Noch keine manuellen Karten. Suche eine Karte und klicke auf &ldquo;Manuell hinzufügen&rdquo;.
            </p>
          </div>
        ) : (
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-2 border-b border-border text-[10px] text-slate-600 uppercase tracking-wide font-medium">
              <span className="w-8" />
              <span>Karte</span>
              <span className="w-28 text-right">Trend</span>
              <span className="w-24 text-center">CM-ID</span>
              <span className="w-20" />
            </div>
            <div className="divide-y divide-border">
              {cards.map(card => (
                <ManualCardRow
                  key={card.id}
                  card={card}
                  onEdit={() => setEditId(card.id)}
                  onDelete={() => { deleteManualCard(card.id); reload(); }}
                  onRefresh={() => refreshCard(card)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── KI-Einstellungen ── */}
      <section>
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">KI-Einstellungen</h2>
        <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border">
          {/* API Key */}
          <div className="px-4 py-3 space-y-1.5">
            <label className="text-xs font-medium text-slate-400">API-Key (OpenRouter oder OpenAI)</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={aiSettings.aiApiKey ?? ''}
                onChange={e => saveAi({ aiApiKey: e.target.value })}
                placeholder="sk-or-… oder sk-…"
                className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-poke-yellow/40 transition-colors font-mono"
              />
              <button
                onClick={testAiKey}
                disabled={!aiSettings.aiApiKey || aiTestState === 'loading'}
                className="shrink-0 flex items-center gap-1.5 bg-surface-3 hover:bg-surface-3/70 border border-border text-slate-300 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {aiTestState === 'loading' ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                ) : 'Testen'}
              </button>
            </div>
            {aiTestMsg && (
              <p className={`text-xs ${aiTestState === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{aiTestMsg}</p>
            )}
          </div>

          {/* Model */}
          <div className="px-4 py-3 space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Modell</label>
            <select
              value={aiSettings.aiModel ?? 'openai/gpt-4o-mini'}
              onChange={e => saveAi({ aiModel: e.target.value })}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-poke-yellow/40 transition-colors"
            >
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          {/* Base URL */}
          <div className="px-4 py-3 space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Base URL <span className="text-slate-600">(leer = OpenRouter Standard)</span></label>
            <input
              type="url"
              value={aiSettings.aiBaseUrl ?? ''}
              onChange={e => saveAi({ aiBaseUrl: e.target.value })}
              placeholder="https://openrouter.ai/api/v1"
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-poke-yellow/40 transition-colors font-mono"
            />
          </div>
        </div>
      </section>

      {/* ── Backup & Restore ── */}
      <section>
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Backup &amp; Restore</h2>
        <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3 gap-4">
            <div>
              <p className="text-sm text-white font-medium">Exportieren</p>
              <p className="text-xs text-slate-500">Alle Daten als JSON-Datei herunterladen</p>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 shrink-0 bg-poke-yellow/10 hover:bg-poke-yellow/20 border border-poke-yellow/30 text-poke-yellow rounded-lg px-3 py-2 text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3 gap-4">
            <div>
              <p className="text-sm text-white font-medium">Importieren</p>
              <p className="text-xs text-slate-500">Backup-Datei wiederherstellen (überschreibt vorhandene Daten)</p>
            </div>
            <label className="flex items-center gap-1.5 shrink-0 bg-surface-3 hover:bg-surface-3/70 border border-border text-slate-300 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Datei wählen
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>

          <div className="px-4 py-3">
            <p className="text-xs text-slate-600 mb-2">Einzelne Datenbereiche löschen</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'manualCards',      label: 'Manuelle Karten' },
                { key: 'collection',       label: 'Sammlung' },
                { key: 'cardSnapshots',    label: 'Preis-Snapshots' },
                { key: 'portfolioHistory', label: 'Portfolio-Verlauf' },
              ].map(({ key, label }) =>
                confirmClear === key ? (
                  <div key={key} className="flex items-center gap-1.5 bg-red-900/20 border border-red-700/40 rounded-lg px-2 py-1.5">
                    <span className="text-xs text-red-400">{label} löschen?</span>
                    <button onClick={() => handleClear(key)} className="text-xs text-red-400 font-bold hover:text-red-300 transition-colors px-1">Ja</button>
                    <button onClick={() => setConfirmClear(null)} className="text-xs text-slate-500 hover:text-white transition-colors">✕</button>
                  </div>
                ) : (
                  <button
                    key={key}
                    onClick={() => setConfirmClear(key)}
                    className="text-xs bg-surface-3 hover:bg-red-900/20 border border-border hover:border-red-700/40 text-slate-400 hover:text-red-400 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Speicher-Info ── */}
      <section>
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Speicher-Info</h2>
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <InfoTile label="Manuelle Karten"  value={String(storageStats.manualCards)}      sub="Einträge" />
            <InfoTile label="Sammlung"          value={String(storageStats.collection)}       sub="Karten" />
            <InfoTile label="Preis-Snapshots"   value="SQLite"                                sub="persistent" />
            <InfoTile label="Portfolio-Verlauf" value={`${storageStats.portfolioHistory}`}    sub="Tage" />
          </div>
          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-slate-500">
            <span>Datenspeicher</span>
            <span className="font-mono text-white">SQLite (prisma/dev.db)</span>
          </div>
        </div>
      </section>

      {editId && (
        <ManualCardModal
          cardId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); reload(); }}
        />
      )}
      {showNewCard && (
        <ManualCardModal
          onClose={() => setShowNewCard(false)}
          onSaved={() => { setShowNewCard(false); reload(); }}
        />
      )}
    </div>
  );
}

function ManualCardRow({ card, onEdit, onDelete, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const trend     = card?.pricing?.cardmarket?.trend ?? null;
  const updatedAt = card._pricesUpdatedAt
    ? new Date(card._pricesUpdatedAt).toLocaleDateString('de-DE')
    : null;

  async function doRefresh() {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }

  return (
    <div className="flex md:grid md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-surface-3/30 transition-colors">
      <div className="shrink-0 w-8 h-11 flex items-center justify-center">
        {card.imageSmall ? (
          <img src={card.imageSmall} alt={card.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="w-8 h-10 bg-surface-3/60 rounded border border-border/40 flex items-center justify-center">
            <svg className="w-3 h-3 text-slate-700" viewBox="0 0 40 56" fill="none">
              <rect x="1" y="1" width="38" height="54" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{card.name}</p>
        <p className="text-xs text-slate-500">
          {card._abbr} #{card.localId}
          {' · '}
          <span className="uppercase">{card._lang ?? 'ja'}</span>
          {card.set?.name ? ` · ${card.set.name}` : ''}
        </p>
      </div>

      <div className="hidden md:block text-right w-28">
        {trend != null ? (
          <>
            <p className="text-sm text-poke-yellow font-semibold">{formatEur(trend)}</p>
            {updatedAt && <p className="text-[10px] text-slate-600">{updatedAt}</p>}
          </>
        ) : (
          <p className="text-sm text-slate-600">–</p>
        )}
      </div>

      <div className="hidden md:flex w-24 justify-center">
        {card.idProduct ? (
          <span className="text-[10px] font-mono bg-blue-900/30 text-blue-400 border border-blue-700/30 px-1.5 py-0.5 rounded">
            #{card.idProduct}
          </span>
        ) : (
          <span className="text-[10px] text-slate-700">–</span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0 w-20 justify-end">
        {card.idProduct && (
          <button onClick={doRefresh} disabled={refreshing} title="Preis aktualisieren"
            className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors disabled:opacity-40 rounded-lg hover:bg-white/5"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button onClick={onEdit} title="Bearbeiten"
          className="p-1.5 text-slate-600 hover:text-poke-yellow rounded-lg hover:bg-poke-yellow/5 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {delConfirm ? (
          <div className="flex items-center gap-0.5">
            <button onClick={onDelete} className="text-xs text-red-400 font-bold hover:text-red-300 px-1 transition-colors">Ja</button>
            <button onClick={() => setDelConfirm(false)} className="text-xs text-slate-600 hover:text-white px-0.5 transition-colors">✕</button>
          </div>
        ) : (
          <button onClick={() => setDelConfirm(true)} title="Löschen"
            className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-red-900/10 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function InfoTile({ label, value, sub }) {
  return (
    <div className="bg-surface-3/40 border border-border/50 rounded-lg p-3">
      <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-600 font-mono mt-0.5">{sub}</p>
    </div>
  );
}
