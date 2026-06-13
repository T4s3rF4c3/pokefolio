import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Cardmarket S3 price/product dumps — no auth, no Cloudflare challenge
      '/cm-s3': {
        target: 'https://downloads.s3.cardmarket.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/cm-s3/, ''),
      },
    },
  },
})
