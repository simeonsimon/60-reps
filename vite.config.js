import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from './tailwind.config.js'

// base: './' keeps all asset URLs relative so the built `dist/` folder works
// no matter where it is served from — including a GitHub Pages project page
// (https://user.github.io/repo/) reached by drag-and-drop deploy.
//
// PostCSS plugins are declared inline (rather than via a separate
// postcss.config.js) so Tailwind runs regardless of the working directory Vite
// is launched from — config discovery is otherwise relative to process.cwd().
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in main.jsx
      manifest: {
        name: '60 Reps',
        short_name: '60 Reps',
        description: '60 Reps — a no-guilt 3D habit builder. Build the climb, one rep at a time.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0b',
        theme_color: '#0a0a0b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // The three.js bundle is comfortably over workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // SW only in production builds; dev uses plain HMR
      },
    }),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
})
