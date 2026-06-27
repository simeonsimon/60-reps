import { mulberry32 } from '../lib/rng.js'

// Shared so the terrain mesh and the asset-population engine place things on
// exactly the same surface.
export const TERRAIN = { size: 11, segs: 26 }

/**
 * Build a deterministic height field for a given integer seed. Returns a
 * function (x, z) => height. A few sine/cosine octaves give rolling low-poly
 * relief; a Gaussian mound seats a central mountain mass toward the back.
 */
export function makeHeightField(seed) {
  const rand = mulberry32(seed >>> 0)
  const octaves = []
  for (let i = 0; i < 4; i++) {
    octaves.push({
      fx: 0.22 + rand() * 0.55 * (i + 1),
      fz: 0.22 + rand() * 0.55 * (i + 1),
      px: rand() * Math.PI * 2,
      pz: rand() * Math.PI * 2,
      a: 1.3 / (i + 1),
    })
  }
  const ridgeX = (rand() - 0.5) * 3
  const ridgeZ = -1.4 - rand() * 1.6
  const moundH = 2.8 + rand() * 1.4

  return function heightAt(x, z) {
    let h = 0
    for (const k of octaves) {
      h += k.a * Math.sin(k.fx * x + k.px) * Math.cos(k.fz * z + k.pz)
    }
    const dx = x - ridgeX
    const dz = z - ridgeZ
    const mound = moundH * Math.exp(-(dx * dx + dz * dz) / 9)
    return h * 0.55 + mound
  }
}
