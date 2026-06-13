import path from 'node:path';

/**
 * Resolve `DATABASE_URL` (e.g. `file:./dev.db`) to an absolute filesystem
 * path. Prisma resolves relative SQLite paths against the schema directory,
 * not the cwd, so we mirror that to stay correct under `next dev` / `next start`.
 */
export function resolveSqlitePath(): string {
  const raw = process.env.DATABASE_URL ?? 'file:./dev.db';
  const stripped = raw.replace(/^file:/, '');
  if (path.isAbsolute(stripped)) return stripped;
  // Prisma resolves relative paths against the directory of schema.prisma.
  return path.resolve(process.cwd(), 'prisma', stripped);
}

/** First 16 bytes of a SQLite 3 file are the magic header. */
export function isSqliteHeader(buf: Buffer): boolean {
  const magic = 'SQLite format 3\0';
  if (buf.length < magic.length) return false;
  return buf.subarray(0, magic.length).toString('binary') === magic;
}
