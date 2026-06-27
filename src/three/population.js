import { mulberry32 } from '../lib/rng.js'
import { TERRAIN, makeHeightField } from './terrainShape.js'

/**
 * Deterministic diorama layout for a habit. Every slot has an `appearAtReps`
 * threshold, so as the habit's rep count climbs, new low-poly elements come
 * into existence (and animate in). A new element roughly every 2 reps, with
 * architecture (watchtowers) on a regular cadence and a victory flag at the
 * summit (60 reps).
 */
export function makeLayout(seed) {
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  const heightAt = makeHeightField(seed)
  const reach = TERRAIN.size * 0.46
  const slots = []
  const N = 34

  for (let i = 0; i < N; i++) {
    const x = (rand() * 2 - 1) * reach
    const z = (rand() * 2 - 1) * reach
    const y = heightAt(x, z)

    let kind
    if ((i + 1) % 6 === 0) {
      kind = 'tower' // architecture cadence
    } else {
      const r = rand()
      kind = r < 0.62 ? 'tree' : r < 0.88 ? 'rock' : 'crystal'
    }

    slots.push({
      id: `${kind}-${i}`,
      kind,
      position: [x, y, z],
      rotation: rand() * Math.PI * 2,
      scale: 0.65 + rand() * 0.7,
      appearAtReps: (i + 1) * 2,
    })
  }

  // Locate the highest point for a summit flag.
  let peak = { x: 0, z: 0, y: -Infinity }
  for (let gx = -reach; gx <= reach; gx += 0.6) {
    for (let gz = -reach; gz <= reach; gz += 0.6) {
      const y = heightAt(gx, gz)
      if (y > peak.y) peak = { x: gx, z: gz, y }
    }
  }
  slots.push({
    id: 'summit-flag',
    kind: 'flag',
    position: [peak.x, peak.y, peak.z],
    rotation: 0,
    scale: 1,
    appearAtReps: 60,
  })

  return slots
}

export function visibleAssets(layout, reps) {
  return layout.filter((s) => reps >= s.appearAtReps)
}
