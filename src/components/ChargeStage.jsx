import { forwardRef, useImperativeHandle, useRef } from 'react'
import { prefersReducedMotion } from '../lib/device.js'

// The completion surface. A plain, grained backdrop that stays out of the way
// until you press it — then the whole surface charges up under your thumb.
//
// Every hold frame is painted by mutating style directly through refs. React
// never re-renders mid-gesture, which is what keeps the hold smooth on iPhone
// (the same reason the old WebGL scene read progress from a ref).

const R = 58
const CIRC = 2 * Math.PI * R
const SPARK_COUNT = 16
const READY_AT = 0.85 // where the ring commits and the label flips to "Send it"

const ChargeStage = forwardRef(function ChargeStage({ accentGlow = true }, ref) {
  const root = useRef(null)
  const vignette = useRef(null)
  const bloom = useRef(null)
  const ring = useRef(null)
  const arc = useRef(null)
  const wave = useRef(null)
  const label = useRef(null)
  const sparks = useRef([])
  const settleTimer = useRef(0)

  function setTransition(value) {
    for (const el of [vignette.current, bloom.current, ring.current, arc.current, label.current]) {
      if (el) el.style.transition = value
    }
  }

  useImperativeHandle(ref, () => ({
    // Anchor everything to where the finger actually landed — but keep the ring
    // and its label fully on the stage. Pressing low or near an edge would
    // otherwise clip the ring and push the label out through overflow-hidden.
    origin(clientX, clientY) {
      const box = root.current?.getBoundingClientRect()
      if (!box) return
      const pad = R + 12
      const x = Math.min(Math.max(clientX - box.left, pad), Math.max(box.width - pad, pad))
      const y = Math.min(Math.max(clientY - box.top, pad), Math.max(box.height - (R + 52), pad))
      root.current.style.setProperty('--ox', `${x}px`)
      root.current.style.setProperty('--oy', `${y}px`)
    },

    arm() {
      clearTimeout(settleTimer.current)
      setTransition('none')
      if (ring.current) ring.current.style.opacity = '1'
      if (label.current) label.current.style.opacity = '1'
    },

    // Called every animation frame of the hold — keep this cheap.
    paint(p) {
      const reduced = prefersReducedMotion()
      const ready = p >= READY_AT

      if (vignette.current) vignette.current.style.opacity = String(p * 0.55)

      if (bloom.current) {
        bloom.current.style.opacity = String(0.12 + p * 0.55)
        // Grows toward the thumb, then tightens as it commits.
        bloom.current.style.transform = `translate(-50%, -50%) scale(${reduced ? 1 : 0.55 + p * 0.75})`
      }

      if (arc.current) {
        arc.current.style.strokeDashoffset = String(CIRC * (1 - p))
        arc.current.style.stroke = ready ? 'rgb(var(--c-ink))' : 'rgb(var(--c-accent))'
        arc.current.style.strokeWidth = ready ? '6' : '4'
      }

      if (ring.current && !reduced) {
        // A breath of scale so the ring feels like it's under tension.
        ring.current.style.transform = `translate(-50%, -50%) scale(${0.92 + p * 0.12})`
      }

      if (label.current) {
        const next = ready ? 'Send it' : p > 0.45 ? 'Climb…' : 'Grip…'
        if (label.current.textContent !== next) label.current.textContent = next
        label.current.style.color = ready ? 'rgb(var(--c-ink))' : 'rgb(var(--c-accent))'
      }
    },

    // Released early, or finished — ease everything back instead of snapping.
    rest() {
      setTransition(`opacity 320ms var(--ease-out-quart), transform 320ms var(--ease-out-quart),
                     stroke-dashoffset 260ms var(--ease-out-quart)`)
      if (vignette.current) vignette.current.style.opacity = '0'
      if (bloom.current) {
        bloom.current.style.opacity = '0'
        bloom.current.style.transform = 'translate(-50%, -50%) scale(0.5)'
      }
      if (arc.current) arc.current.style.strokeDashoffset = String(CIRC)
      if (ring.current) {
        ring.current.style.opacity = '0'
        ring.current.style.transform = 'translate(-50%, -50%) scale(0.92)'
      }
      if (label.current) label.current.style.opacity = '0'
      settleTimer.current = setTimeout(() => setTransition('none'), 340)
    },

    // The payoff: a shockwave off the thumb plus a scatter of sparks.
    fire() {
      if (prefersReducedMotion()) {
        // Still acknowledge the rep, just without the flying parts.
        bloom.current?.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' })
        return
      }

      wave.current?.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.35)', opacity: 0.9, borderWidth: '3px' },
          { transform: 'translate(-50%, -50%) scale(2.6)', opacity: 0, borderWidth: '1px' },
        ],
        { duration: 720, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )

      for (const spark of sparks.current) {
        if (!spark) continue
        const angle = Math.random() * Math.PI * 2
        const distance = 90 + Math.random() * 130
        spark.animate(
          [
            { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1)', opacity: 1 },
            {
              transform: `translate(-50%, -50%) translate(${Math.cos(angle) * distance}px, ${
                Math.sin(angle) * distance
              }px) scale(0)`,
              opacity: 0,
            },
          ],
          { duration: 560 + Math.random() * 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        )
      }
    },
  }))

  return (
    <div
      ref={root}
      className="grain absolute inset-0 overflow-hidden"
      style={{
        // Plain base with one soft wash of the skin's accent, high and centred,
        // so the surface has somewhere to breathe without becoming a gradient.
        background: accentGlow
          ? 'radial-gradient(120% 80% at 50% 18%, rgb(var(--c-accent) / 0.10), transparent 62%), rgb(var(--c-accent-contrast))'
          : 'rgb(var(--c-accent-contrast))',
        // Origin defaults to centre until a finger lands.
        '--ox': '50%',
        '--oy': '50%',
      }}
    >
      {/* Edge darkening that deepens as the hold matures — pulls the eye in. */}
      <div
        ref={vignette}
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0,
          background: 'radial-gradient(70% 55% at 50% 50%, transparent 40%, rgb(0 0 0 / 0.85))',
        }}
      />

      {/* The charge itself, blooming from the contact point. */}
      <div
        ref={bloom}
        className="pointer-events-none absolute h-[26rem] w-[26rem] rounded-full"
        style={{
          left: 'var(--ox)',
          top: 'var(--oy)',
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.5)',
          background:
            'radial-gradient(circle, rgb(var(--c-accent) / 0.55), rgb(var(--c-accent) / 0.14) 45%, transparent 70%)',
        }}
      />

      {/* Progress ring, directly under the thumb rather than parked at the
          bottom of the screen — the feedback belongs where the contact is. */}
      <svg
        ref={ring}
        className="pointer-events-none absolute"
        width={(R + 8) * 2}
        height={(R + 8) * 2}
        viewBox={`0 0 ${(R + 8) * 2} ${(R + 8) * 2}`}
        style={{ left: 'var(--ox)', top: 'var(--oy)', opacity: 0, transform: 'translate(-50%, -50%) scale(0.92)' }}
      >
        <circle
          cx={R + 8}
          cy={R + 8}
          r={R}
          fill="none"
          stroke="rgb(var(--c-ink) / 0.12)"
          strokeWidth="4"
        />
        <circle
          ref={arc}
          cx={R + 8}
          cy={R + 8}
          r={R}
          fill="none"
          stroke="rgb(var(--c-accent))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC}
          transform={`rotate(-90 ${R + 8} ${R + 8})`}
        />
      </svg>

      {/* Charge state, sitting just under the ring so it reads without the
          eye leaving the contact point. */}
      <div
        ref={label}
        className="pointer-events-none absolute text-center text-sm font-bold tracking-wide"
        style={{
          left: 'var(--ox)',
          top: `calc(var(--oy) + ${R + 34}px)`,
          opacity: 0,
          transform: 'translateX(-50%)',
          color: 'rgb(var(--c-accent))',
          textShadow: '0 1px 10px rgb(0 0 0 / 0.7)',
        }}
      >
        Grip…
      </div>

      {/* Completion shockwave. */}
      <div
        ref={wave}
        className="pointer-events-none absolute h-40 w-40 rounded-full border border-accent"
        style={{ left: 'var(--ox)', top: 'var(--oy)', opacity: 0, transform: 'translate(-50%, -50%) scale(0.35)' }}
      />

      {/* Sparks are created once and re-animated on each rep — no DOM churn. */}
      {Array.from({ length: SPARK_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(el) => (sparks.current[i] = el)}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-accent"
          style={{ left: 'var(--ox)', top: 'var(--oy)', opacity: 0, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  )
})

export default ChargeStage
