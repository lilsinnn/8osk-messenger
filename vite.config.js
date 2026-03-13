import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['8osk%20white.png'],
      manifest: {
        name: '8osk Messenger',
        short_name: '8osk',
        description: 'Secure P2P Encrypted Messenger',
        theme_color: '#0D0D12',
        background_color: '#0D0D12',
        display: 'standalone',
        icons: [
          {
            src: '8osk%20white.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '8osk%20white.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '8osk%20white.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  base: './',
})
