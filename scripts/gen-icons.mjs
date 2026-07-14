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

// iPhone 15 Pro splash (393x852 @3x, portrait). Mirrors the in-app boot
// screen's final frame (mountain + wordmark) so splash → boot is seamless.
{
  const W = 1179
  const H = 2556
  const splash = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0b"/>
  <g transform="translate(${W / 2 - 132} ${H / 2 - 160}) scale(8.25)">
    <path d="M5 24 13 10l4 6 2.5-4L27 24Z" fill="none" stroke="#7aa2ff"
      stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
  <text x="${W / 2 + 5}" y="${H / 2 + 118}" text-anchor="middle" fill="#f5f5f7" fill-opacity="0.92"
    font-family="-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    font-size="45" font-weight="800" letter-spacing="10">60 REPS</text>
</svg>`)
  await sharp(splash).png().toFile(path.join(out, 'apple-splash-1179x2556.png'))
  console.log('wrote apple-splash-1179x2556.png')
}
