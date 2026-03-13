import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', '8osk white.png'],
      manifest: {
        name: '8osk Messenger',
        short_name: '8osk',
        description: 'Secure Peer-to-Peer Encrypted Communicator',
        theme_color: '#0f0f13',
        background_color: '#0f0f13',
        display: 'standalone',
        icons: [
          {
            src: '8osk white.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '8osk white.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm}'],
        maximumFileSizeToCacheInBytes: 5000000 // 5MB limit to accommodate larger built chunks if any
      }
    })
  ],
  base: './', // important for both electron and gh-pages/ipfs
})
