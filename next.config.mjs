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
  },
};

export default nextConfig;
