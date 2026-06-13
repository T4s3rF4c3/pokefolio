import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pokéfolio — TCG Portfolio',
    short_name: 'Pokéfolio',
    description: 'Self-hosted Pokémon TCG portfolio: collection, binders, wishlist, prices.',
    start_url: '/',
    display: 'standalone',
    background_color: '#06070d',
    theme_color: '#ff4d0a',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  };
}
