import { NextResponse } from 'next/server';
import { copyFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { isSqliteHeader, resolveSqlitePath } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * POST /api/backup/import
 *
 * Multipart upload of a SQLite snapshot produced by `/api/backup/export`.
 *
 * Strategy:
 *  1. Stash the upload in a temp file alongside dev.db.
 *  2. Validate the SQLite magic header — we don't want to clobber the db
 *     with random bytes.
 *  3. Snapshot the current dev.db to `dev.db.bak-<ts>` as a one-shot
 *     undo if the import turns out to be corrupt.
 *  4. Disconnect Prisma (releases the file handle on Windows; on POSIX the
 *     swap works without this, but disconnecting also forces a fresh
 *     connection on the next request so the new schema is picked up).
 *  5. Atomically `rename()` the temp file over dev.db.
 *
 * The next request reconnects to the freshly imported database. Long-lived
 * tabs may show a stale page until reload — the UI tells the user.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Kein multipart/form-data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Datei fehlt' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Ungültige Dateigröße (${file.size} bytes, max ${MAX_BYTES})` },
      { status: 413 },
    );
  }

  const dbPath = resolveSqlitePath();
  const dir = path.dirname(dbPath);
  const tmp = path.join(dir, `import-${Date.now()}-${randomBytes(4).toString('hex')}.db`);

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (!isSqliteHeader(buf)) {
      return NextResponse.json(
        { error: 'Datei ist keine gültige SQLite-Datenbank.' },
        { status: 415 },
      );
    }
    await writeFile(tmp, buf);

    // Snapshot current DB before the swap so the user has a safety net.
    let backupPath: string | null = null;
    if (existsSync(dbPath)) {
      backupPath = path.join(
        dir,
        `dev.db.bak-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
      );
      await copyFile(dbPath, backupPath);
    }

    // Release Prisma's pool so the file handle / wal/-shm sidecars unlock.
    await prisma.$disconnect();
    await rename(tmp, dbPath);

    return NextResponse.json({
      ok: true,
      bytes: buf.length,
      backup: backupPath ? path.basename(backupPath) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Import fehlgeschlagen', details: String(err) },
      { status: 500 },
    );
  }
}
