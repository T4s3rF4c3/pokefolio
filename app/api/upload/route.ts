import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Multipart upload for Custom Card images.
 *
 * Saves to `public/uploads/<random>.<ext>` and returns the public URL.
 * The folder is gitignored. Files outlive the deployment, so for a real
 * production setup you'd swap this for S3 / R2 — same return shape.
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
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: `Dateityp nicht erlaubt: ${file.type || 'unknown'}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei > ${MAX_BYTES / 1024 / 1024} MB` },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = EXT[file.type];
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;

  const dir = path.join(process.cwd(), 'public', 'uploads');
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);

  return NextResponse.json({
    url: `/uploads/${name}`,
    size: file.size,
    type: file.type,
  });
}
