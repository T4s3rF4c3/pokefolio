import express from 'express';
import { PrismaClient } from '@prisma/client';
import { runDailySnapshot, scheduleDailySnapshot } from './snapshot.js';

const prisma = new PrismaClient();

function entryId(cardId, variant) {
  return `${cardId}:${variant ?? 'normal'}`;
}
const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

// ── Collection ───────────────────────────────────────
app.get('/api/collection', async (_req, res) => {
  try {
    const rows = await prisma.collectionEntry.findMany();
    res.json(rows.map(r => JSON.parse(r.data)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ein Eintrag pro Karte+Variante – PUT/DELETE adressieren immer eine Variante
app.put('/api/collection/:cardId/:variant', async (req, res) => {
  try {
    const { cardId, variant } = req.params;
    const id = entryId(cardId, variant);
    const data = JSON.stringify({ ...req.body, cardId, variant });
    await prisma.collectionEntry.upsert({
      where: { id }, create: { id, cardId, variant, data }, update: { data },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/collection/:cardId/:variant', async (req, res) => {
  try {
    const id = entryId(req.params.cardId, req.params.variant);
    await prisma.collectionEntry.delete({ where: { id } }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alle Varianten-Einträge einer Karte
app.get('/api/collection/:cardId', async (req, res) => {
  try {
    const rows = await prisma.collectionEntry.findMany({ where: { cardId: req.params.cardId } });
    res.json(rows.map(r => JSON.parse(r.data)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE all collection entries
app.delete('/api/collection', async (_req, res) => {
  try {
    await prisma.collectionEntry.deleteMany();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Manual Cards ─────────────────────────────────────
app.get('/api/manual-cards', async (_req, res) => {
  try {
    const rows = await prisma.manualCard.findMany();
    res.json(Object.fromEntries(rows.map(r => [r.id, JSON.parse(r.data)])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/manual-cards/:id', async (req, res) => {
  try {
    const row = await prisma.manualCard.findUnique({ where: { id: req.params.id } });
    res.json(row ? JSON.parse(row.data) : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/manual-cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = JSON.stringify({ ...req.body, id, _source: 'manual' });
    await prisma.manualCard.upsert({
      where: { id }, create: { id, data }, update: { data },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/manual-cards/:id', async (req, res) => {
  try {
    await prisma.manualCard.delete({ where: { id: req.params.id } }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE all manual cards
app.delete('/api/manual-cards', async (_req, res) => {
  try {
    await prisma.manualCard.deleteMany();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Settings ─────────────────────────────────────────
app.get('/api/settings', async (_req, res) => {
  try {
    const rows = await prisma.setting.findMany();
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', async (req, res) => {
  try {
    const entries = Object.entries(req.body).filter(([, v]) => v !== undefined && v !== null);
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        })
      )
    );
    const rows = await prisma.setting.findMany();
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Card Snapshots ────────────────────────────────────
app.get('/api/snapshots/:cardId', async (req, res) => {
  try {
    const snaps = await prisma.cardSnapshot.findMany({
      where: { cardId: req.params.cardId },
      orderBy: { date: 'asc' },
    });
    res.json(snaps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/snapshots/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { date, trend, avg7, avg30 } = req.body;
    await prisma.cardSnapshot.upsert({
      where: { cardId_date: { cardId, date } },
      create: { cardId, date, trend: trend ?? null, avg7: avg7 ?? null, avg30: avg30 ?? null },
      update: { trend: trend ?? null, avg7: avg7 ?? null, avg30: avg30 ?? null },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE all snapshots
app.delete('/api/snapshots', async (_req, res) => {
  try {
    await prisma.cardSnapshot.deleteMany();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Portfolio History ─────────────────────────────────
app.get('/api/portfolio', async (_req, res) => {
  try {
    const rows = await prisma.portfolioSnapshot.findMany({ orderBy: { date: 'asc' } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/portfolio', async (req, res) => {
  try {
    const { date, value } = req.body;
    await prisma.portfolioSnapshot.upsert({
      where: { date }, create: { date, value }, update: { value },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE all portfolio history
app.delete('/api/portfolio', async (_req, res) => {
  try {
    await prisma.portfolioSnapshot.deleteMany();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Backup / Restore ──────────────────────────────────
app.get('/api/backup', async (_req, res) => {
  try {
    const [colRows, mcRows, snapRows, portRows, settRows] = await Promise.all([
      prisma.collectionEntry.findMany(),
      prisma.manualCard.findMany(),
      prisma.cardSnapshot.findMany({ orderBy: { date: 'asc' } }),
      prisma.portfolioSnapshot.findMany({ orderBy: { date: 'asc' } }),
      prisma.setting.findMany(),
    ]);
    const snapsByCard = {};
    for (const s of snapRows) {
      (snapsByCard[s.cardId] ??= []).push({ date: s.date, trend: s.trend, avg7: s.avg7, avg30: s.avg30 });
    }
    res.json({
      exportedAt: new Date().toISOString(),
      version: 2,
      collection: colRows.map(r => JSON.parse(r.data)),
      manualCards: Object.fromEntries(mcRows.map(r => [r.id, JSON.parse(r.data)])),
      cardSnapshots: snapsByCard,
      portfolioHistory: portRows,
      settings: Object.fromEntries(settRows.map(r => [r.key, r.value])),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/backup', async (req, res) => {
  try {
    const data = req.body;
    if (!data.version) return res.status(400).json({ error: 'Keine gültige Backup-Datei' });

    await prisma.$transaction([
      prisma.collectionEntry.deleteMany(),
      prisma.manualCard.deleteMany(),
      prisma.cardSnapshot.deleteMany(),
      prisma.portfolioSnapshot.deleteMany(),
      prisma.setting.deleteMany(),
    ]);

    if (data.collection?.length) {
      await prisma.collectionEntry.createMany({
        data: data.collection.map(e => {
          const variant = e.variant ?? (e.isHolo ? 'holo' : 'normal');
          return {
            id: entryId(e.cardId, variant),
            cardId: e.cardId,
            variant,
            data: JSON.stringify({ ...e, variant }),
          };
        }),
      });
    }
    if (data.manualCards) {
      const mc = Object.entries(data.manualCards);
      if (mc.length) await prisma.manualCard.createMany({
        data: mc.map(([id, c]) => ({ id, data: JSON.stringify(c) })),
      });
    }
    if (data.cardSnapshots) {
      const rows = [];
      for (const [cardId, snaps] of Object.entries(data.cardSnapshots)) {
        for (const s of snaps) rows.push({ cardId, date: s.date, trend: s.trend ?? null, avg7: s.avg7 ?? null, avg30: s.avg30 ?? null });
      }
      if (rows.length) await prisma.cardSnapshot.createMany({ data: rows });
    }
    if (data.portfolioHistory?.length) {
      await prisma.portfolioSnapshot.createMany({ data: data.portfolioHistory });
    }
    if (data.settings) {
      const sRows = Object.entries(data.settings).map(([key, value]) => ({ key, value: String(value) }));
      if (sRows.length) await prisma.setting.createMany({ data: sRows });
    }

    res.json({ ok: true, importedAt: data.exportedAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Snapshot manuell anstoßen (z.B. aus dem Admin-Bereich)
app.post('/api/snapshot/run', async (_req, res) => {
  try {
    const result = await runDailySnapshot(prisma, { force: true });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Serve static frontend in production
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, '..', 'dist')));

app.listen(PORT, () => {
  console.log(`PokéCapital API running on http://localhost:${PORT}`);
  scheduleDailySnapshot(prisma);
});
