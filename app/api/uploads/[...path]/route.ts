import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serve user-uploaded Custom Card images at runtime.
 *
 * Files are written to `public/uploads/` by /api/upload, but Next.js'
 * standalone server only picks up files in `public/` that existed when it
 * booted — runtime uploads 404 until the next container restart. A
 * `beforeFiles` rewrite (next.config.mjs) maps every `/uploads/*` request here
 * so the file is streamed straight off disk, keeping the public URL shape
 * (`/uploads/<name>`) that existing CustomCard rows already store.
 */

const ROOT = path.join(process.cwd(), 'public', 'uploads');

const CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
) {
  // Join + normalize, then confirm the resolved path stays inside ROOT so a
  // crafted "../" segment can't read arbitrary files.
  const rel = path.normalize(path.join(...(params.path ?? [])));
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep) || !existsSync(abs)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buf = await readFile(abs);
  const type = CONTENT_TYPE[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
