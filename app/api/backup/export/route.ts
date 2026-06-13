import { NextResponse } from 'next/server';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { resolveSqlitePath } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/backup/export
 *
 * Streams a consistent SQLite snapshot of the running database.
 *
 * Uses `VACUUM INTO` so any open WAL pages are flushed and we get a
 * single-file, checkpoint-clean copy without having to stop the server or
 * coordinate with in-flight writes.
 */
export async function GET() {
  const tmp = path.join(
    path.dirname(resolveSqlitePath()),
    `backup-${Date.now()}-${randomBytes(4).toString('hex')}.db`,
  );
  try {
    // VACUUM INTO writes a fully checkpointed copy to the target path.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const buf = await readFile(tmp);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="pokefolio-${stamp}.db"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Backup fehlgeschlagen', details: String(err) },
      { status: 500 },
    );
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
