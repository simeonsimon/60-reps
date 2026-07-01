// Generates all PWA / iOS icons + the iPhone splash screen into public/.
// Run once (or whenever the logo changes):  node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const out = path.join(root, 'public')
mkdirSync(out, { recursive: true })

// The 60 Reps mountain mark. `pad` controls how much breathing room the
// mountain gets inside the square (maskable icons need a bigger safe zone).
function logoSvg(size, { pad = 0.16, bg = '#0a0a0b', rounded = false } = {}) {
  const inner = size * (1 - pad * 2)
  const off = size * pad
  const rx = rounded ? size * 0.22 : 0
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${bg}"/>
  <radialGradient id="g" cx="50%" cy="18%" r="80%">
    <stop offset="0%" stop-color="#7aa2ff" stop-opacity="0.22"/>
    <stop offset="60%" stop-color="#7aa2ff" stop-opacity="0"/>
  </radialGradient>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>
  <g transform="translate(${off} ${off}) scale(${inner / 32})">
    <path d="M5 24 13 10l4 6 2.5-4L27 24Z" fill="none" stroke="#7aa2ff"
      stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="13" cy="10" r="1.1" fill="#e8efff"/>
  </g>
</svg>`)
}

async function png(name, size, opts) {
  await sharp(logoSvg(size, opts)).png().toFile(path.join(out, name))
  console.log('wrote', name)
}

// Standard PWA icons (transparent-corner rounding handled by the OS).
await png('pwa-192.png', 192, { pad: 0.14 })
await png('pwa-512.png', 512, { pad: 0.14 })
// Maskable: content inside the central 80% safe zone.
await png('maskable-512.png', 512, { pad: 0.24 })
// iOS home-screen icon: full-bleed square, iOS rounds it itself.
await png('apple-touch-icon.png', 180, { pad: 0.16 })

// iPhone 15 Pro splash (393x852 @3x, portrait). Logo centred on the app bg.
{
  const W = 1179
  const H = 2556
  const logo = await sharp(logoSvg(420, { pad: 0.1, bg: 'transparent' })).png().toBuffer()
  await sharp({ create: { width: W, height: H, channels: 4, background: '#0a0a0b' } })
    .composite([{ input: logo, left: Math.round((W - 420) / 2), top: Math.round((H - 420) / 2) }])
    .png()
    .toFile(path.join(out, 'apple-splash-1179x2556.png'))
  console.log('wrote apple-splash-1179x2556.png')
}
