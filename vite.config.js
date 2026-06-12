import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Same-origin proxy to Yahoo Finance (no CORS headers on their end, no API key needed).
// Works in `vite dev` and `vite preview`; a static host would need its own rewrite rule.
const yahooProxy = {
  '/yq': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/yq/, ''),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  },
}

export default defineConfig({
  server: { proxy: yahooProxy },
  preview: { proxy: yahooProxy },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AFD OS — personal mission control',
        short_name: 'AFD OS',
        description: 'Personal OS — finance, fitness & calorie tracking',
        theme_color: '#04060C',
        background_color: '#04060C',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'finance', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
