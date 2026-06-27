import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(tailwindConfig), autoprefixer()],
    },
  },
})
