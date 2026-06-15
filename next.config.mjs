/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal self-contained server bundle in .next/standalone so the
  // Docker runtime image stays small (only the files Next actually needs).
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.tcgdex.net' },
      { protocol: 'https', hostname: '**.tcgdex.net' },
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
    ],
  },
  experimental: {
    typedRoutes: false,
    // Enables instrumentation.ts → register(), where the daily price-sync
    // scheduler is started inside the running server process.
    instrumentationHook: true,
  },
  // `beforeFiles` runs before the public/static handler, so runtime-uploaded
  // images (which the standalone server otherwise 404s until restart) are
  // served by the /api/uploads route handler instead. Keeps the /uploads/<name>
  // URL shape already stored on CustomCard rows.
  async rewrites() {
    return {
      beforeFiles: [{ source: '/uploads/:path*', destination: '/api/uploads/:path*' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
