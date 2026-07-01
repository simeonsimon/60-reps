import { Suspense, memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { hashSeed } from '../lib/rng.js'
import { maxDpr, prefersReducedMotion } from '../lib/device.js'
import Terrain from './Terrain.jsx'
import { Asset } from './LowPoly.jsx'
import { makeLayout, visibleAssets } from './population.js'
import Particles from './Particles.jsx'

// The diorama group: gentle idle rotation, a live scale-pulse driven by the
// hold gesture (read from a ref to avoid per-frame React renders), and a
// springy bounce each time a rep is banked.
function Diorama({ seed, def, reps, progressRef, burst }) {
  const group = useRef()
  const bounce = useRef(0)
  const lastBurst = useRef(burst)
  const scaleRef = useRef(1)

  const layout = useMemo(() => makeLayout(seed), [seed])
  const assets = useMemo(() => visibleAssets(layout, reps), [layout, reps])

  useFrame((_, delta) => {
    if (!group.current) return
    if (burst !== lastBurst.current) {
      lastBurst.current = burst
      bounce.current = 0.16
    }
    bounce.current = THREE.MathUtils.damp(bounce.current, 0, 6, delta)

    const hold = progressRef?.current || 0
    const target = 1 + hold * 0.14 + bounce.current
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, target, 12, delta)
    group.current.scale.setScalar(scaleRef.current)
    // Skip the idle spin for users who prefer reduced motion (also saves power).
    if (!prefersReducedMotion()) group.current.rotation.y += delta * 0.12
  })

  return (
    <group ref={group}>
      <Terrain seed={seed} def={def} />
      {assets.map((slot) => (
        <Asset key={slot.id} slot={slot} def={def} />
      ))}
    </group>
  )
}

function HabitScene({ habit, def, progressRef, burst = 0, active = true, paused = false }) {
  const seed = useMemo(() => hashSeed(habit.id), [habit.id])

  // Nudge R3F to measure its container after mount. In some environments the
  // initial ResizeObserver callback can miss the flex-resolved height, leaving
  // the canvas at its 300×150 default until the first window resize. Firing
  // across a couple of delays guarantees one lands after layout has settled.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'))
    const raf = requestAnimationFrame(fire)
    const t1 = setTimeout(fire, 120)
    const t2 = setTimeout(fire, 400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  // Particle origin near the peak so bursts erupt from the summit.
  const origin = useMemo(() => {
    const layout = makeLayout(seed)
    const peak = layout.find((s) => s.id === 'summit-flag')
    return peak ? [peak.position[0], peak.position[1] + 1.3, peak.position[2]] : [0, 3, 0]
  }, [seed])

  const [bursts, setBursts] = useState([])
  const lastBurst = useRef(burst)
  useEffect(() => {
    if (burst !== lastBurst.current) {
      lastBurst.current = burst
      const id = `${burst}-${Math.random().toString(36).slice(2)}`
      setBursts((b) => [...b, id])
    }
  }, [burst])

  return (
    <Canvas
      // Phones cap at 1.5x — visually crisp, roughly half the GPU work (and
      // battery drain) of rendering at the iPhone's native 3x.
      dpr={[1, maxDpr()]}
      camera={{ position: [0, 4.6, 9], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      // Stop rendering entirely while a sheet covers the scene or the card is
      // off-screen; rAF also pauses automatically when the app is backgrounded.
      frameloop={active && !paused ? 'always' : 'demand'}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <fog attach="fog" args={[def.fog, 11, 24]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={[0xffffff, def.palette.ground, 0.5]} />
      <directionalLight position={[5, 9, 5]} intensity={1.15} />
      <directionalLight position={[-6, 4, -3]} intensity={0.4} color={def.palette.accent} />

      <Suspense fallback={null}>
        <Diorama seed={seed} def={def} reps={habit.reps} progressRef={progressRef} burst={burst} />
        {/* Procedural environment map (baked once, fully offline) so metallic
            skins like Karat have something to reflect. */}
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={1.2} position={[0, 5, -2]} scale={[10, 10, 1]} color="#ffffff" />
          <Lightformer intensity={0.6} position={[4, 2, 3]} scale={[4, 4, 1]} color={def.palette.accent} />
        </Environment>
      </Suspense>

      {bursts.map((id) => (
        <Particles
          key={id}
          origin={origin}
          color={def.palette.particle}
          def={def}
          onDone={() => setBursts((b) => b.filter((x) => x !== id))}
        />
      ))}
    </Canvas>
  )
}

export default memo(HabitScene)
