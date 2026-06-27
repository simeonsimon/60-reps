import { useMemo } from 'react'
import * as THREE from 'three'
import { TERRAIN, makeHeightField } from './terrainShape.js'

// Build a faceted low-poly terrain. We displace a plane, convert to
// non-indexed geometry, and paint each triangle a single solid color derived
// from its height — so every face reads as a distinct polygon, the hallmark of
// the flat-shaded look.
function buildGeometry(seed, palette) {
  const { size, segs } = TERRAIN
  const geo = new THREE.PlaneGeometry(size, size, segs, segs)
  geo.rotateX(-Math.PI / 2)

  const heightAt = makeHeightField(seed)
  const pos = geo.attributes.position
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = heightAt(x, z)
    pos.setY(i, y)
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const ng = geo.toNonIndexed()
  ng.computeVertexNormals()

  const cGround = new THREE.Color(palette.ground)
  const cHi = new THREE.Color(palette.groundHi)
  const cSnow = new THREE.Color('#f3f4ff')

  const p = ng.attributes.position
  const colors = new Float32Array(p.count * 3)
  const range = Math.max(0.001, maxY - minY)
  const tmp = new THREE.Color()
  for (let i = 0; i < p.count; i += 3) {
    const avgY = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3
    let f = (avgY - minY) / range
    tmp.copy(cGround).lerp(cHi, Math.min(1, f * 1.2))
    if (f > 0.82) tmp.lerp(cSnow, (f - 0.82) / 0.18) // snow caps on the peaks
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = tmp.r
      colors[(i + k) * 3 + 1] = tmp.g
      colors[(i + k) * 3 + 2] = tmp.b
    }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.dispose()
  return ng
}

export default function Terrain({ seed, def }) {
  const geometry = useMemo(
    () => buildGeometry(seed, def.palette),
    [seed, def.palette.ground, def.palette.groundHi],
  )

  const m = def.material
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        flatShading={m.flatShading}
        wireframe={m.wireframe}
        metalness={m.metalness}
        roughness={m.roughness}
      />
    </mesh>
  )
}
