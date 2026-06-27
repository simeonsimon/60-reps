import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const c1 = 1.70158
const c3 = c1 + 1
const easeOutBack = (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)

// Shared material props derived from the active skin.
function mat(def, extra = {}) {
  const m = def.material
  return {
    flatShading: m.flatShading,
    wireframe: m.wireframe,
    metalness: m.metalness,
    roughness: m.roughness,
    ...extra,
  }
}

/**
 * Wrapper that handles the spawn animation: a new asset pops in with an
 * ease-out-back scale and a small settle from above, so growth feels alive.
 */
function Spawn({ position, rotation = 0, scale = 1, children }) {
  const ref = useRef()
  const t = useRef(0)
  useFrame((_, delta) => {
    if (!ref.current) return
    if (t.current < 1) {
      t.current = Math.min(1, t.current + delta / 0.55)
      const e = Math.max(0, easeOutBack(t.current))
      ref.current.scale.setScalar(scale * e)
      ref.current.position.y = position[1] + (1 - t.current) * 0.6
    }
  })
  return (
    <group ref={ref} position={position} rotation={[0, rotation, 0]} scale={0.0001}>
      {children}
    </group>
  )
}

export function Tree({ def }) {
  const { palette } = def
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 0.56, 5]} />
        <meshStandardMaterial color={palette.trunk} {...mat(def)} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <coneGeometry args={[0.42, 0.8, 6]} />
        <meshStandardMaterial color={palette.foliage} {...mat(def)} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <coneGeometry args={[0.3, 0.62, 6]} />
        <meshStandardMaterial color={palette.foliage} {...mat(def)} />
      </mesh>
    </group>
  )
}

export function Rock({ def }) {
  const { palette } = def
  return (
    <mesh position={[0, 0.18, 0]} scale={[1, 0.7, 1.1]} castShadow>
      <dodecahedronGeometry args={[0.32, 0]} />
      <meshStandardMaterial color={palette.rock} {...mat(def)} />
    </mesh>
  )
}

export function Crystal({ def }) {
  const { palette } = def
  return (
    <mesh position={[0, 0.34, 0]} castShadow>
      <octahedronGeometry args={[0.34, 0]} />
      <meshStandardMaterial
        color={palette.accent}
        {...mat(def, { emissive: palette.accent, emissiveIntensity: 0.45 })}
      />
    </mesh>
  )
}

export function Tower({ def }) {
  const { palette } = def
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.5]} />
        <meshStandardMaterial color={palette.groundHi} {...mat(def)} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[0.36, 0.4, 0.36]} />
        <meshStandardMaterial color={palette.groundHi} {...mat(def)} />
      </mesh>
      <mesh position={[0, 1.22, 0]} castShadow>
        <coneGeometry args={[0.34, 0.4, 4]} />
        <meshStandardMaterial color={palette.accent} {...mat(def)} />
      </mesh>
    </group>
  )
}

export function Flag({ def }) {
  const { palette } = def
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 5]} />
        <meshStandardMaterial color={palette.trunk} {...mat(def)} />
      </mesh>
      <mesh position={[0.24, 1.0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.28, 0.02]} />
        <meshStandardMaterial
          color={palette.accent}
          {...mat(def, { emissive: palette.accent, emissiveIntensity: 0.5 })}
        />
      </mesh>
    </group>
  )
}

const KINDS = { tree: Tree, rock: Rock, crystal: Crystal, tower: Tower, flag: Flag }

export function Asset({ slot, def }) {
  const Comp = KINDS[slot.kind] || Rock
  return (
    <Spawn position={slot.position} rotation={slot.rotation} scale={slot.scale}>
      <Comp def={def} />
    </Spawn>
  )
}
