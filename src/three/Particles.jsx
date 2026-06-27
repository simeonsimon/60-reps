import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 46
const LIFE = 1.5 // seconds
const dummy = new THREE.Object3D()

/**
 * One-shot low-poly particle explosion. Mount it with a changing `key` to fire
 * a fresh burst; it self-reports completion via onDone so the parent can unmount.
 */
export default function Particles({ origin = [0, 2, 0], color = '#ffffff', def, onDone }) {
  const meshRef = useRef()
  const age = useRef(0)
  const done = useRef(false)

  const particles = useMemo(() => {
    const arr = []
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 2.4 + Math.random() * 3.2
      arr.push({
        v: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.abs(Math.cos(phi)) * speed * 0.9 + 1.4,
          Math.sin(phi) * Math.sin(theta) * speed,
        ),
        p: new THREE.Vector3(0, 0, 0),
        spin: (Math.random() - 0.5) * 8,
        size: 0.08 + Math.random() * 0.12,
      })
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    age.current += delta
    const tNorm = Math.min(1, age.current / LIFE)
    const fade = 1 - tNorm

    for (let i = 0; i < COUNT; i++) {
      const pt = particles[i]
      pt.v.y -= 7.5 * delta // gravity
      pt.p.addScaledVector(pt.v, delta)
      dummy.position.set(origin[0] + pt.p.x, origin[1] + pt.p.y, origin[2] + pt.p.z)
      const s = pt.size * fade
      dummy.scale.setScalar(Math.max(0.0001, s))
      dummy.rotation.set(age.current * pt.spin, age.current * pt.spin * 0.7, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    if (tNorm >= 1 && !done.current) {
      done.current = true
      onDone?.()
    }
  })

  const m = def?.material || {}
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        flatShading
        wireframe={!!m.wireframe}
        roughness={0.4}
        metalness={m.metalness ?? 0.1}
      />
    </instancedMesh>
  )
}
