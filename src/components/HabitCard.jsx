import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/StoreProvider.jsx'
import { useSkin } from '../context/SkinContext.jsx'
import { audio } from '../audio/AudioEngine.js'
import { useLongPress } from '../hooks/useLongPress.js'
import HabitScene from '../three/HabitScene.jsx'
import ProgressRing from './ProgressRing.jsx'
import { FlameIcon, TrashIcon } from './icons.jsx'
import {
  GOAL,
  goalPct,
  completedToday,
  sessionPct,
  currentStreak,
  isMastered,
} from '../lib/habits.js'

export default function HabitCard({ habit, active, onUnlock }) {
  const { complete, removeHabit } = useStore()
  const { def } = useSkin()
  const progressRef = useRef(0)
  const [uiProgress, setUiProgress] = useState(0)
  const [burst, setBurst] = useState(0)
  const [shake, setShake] = useState(false)
  const lastTick = useRef(0)
  const startPt = useRef({ x: 0, y: 0 })

  const doneToday = habit.type === 'single' && completedToday(habit)
  const mastered = isMastered(habit)
  const streak = currentStreak(habit)

  function handleComplete() {
    progressRef.current = 0
    setUiProgress(0)
    const prevReps = habit.reps
    const res = complete(habit.id)
    if (res.meta.blocked) {
      audio.blocked()
      setShake(true)
      setTimeout(() => setShake(false), 420)
      return
    }
    if (res.meta.repsGained > 0) {
      setBurst((b) => b + 1)
      if (prevReps < GOAL && prevReps + res.meta.repsGained >= GOAL) audio.summit()
      else audio.complete()
    } else {
      audio.tick() // progress added toward the session, no full rep yet
    }
    if (res.unlocked?.length) {
      audio.achievement()
      onUnlock?.(res.unlocked)
    }
  }

  function handleDelete() {
    const ok = window.confirm(
      `Delete “${habit.title}”?\n\nYour ${habit.reps}-rep climb and its history will be removed. This can't be undone.`,
    )
    if (!ok) return
    audio.swipe()
    removeHabit(habit.id)
  }

  const { handlers, holding, cancel } = useLongPress({
    duration: 850,
    disabled: doneToday,
    onStart: () => audio.resume(),
    onProgress: (p) => {
      progressRef.current = p
      setUiProgress(p)
      const now = performance.now()
      if (now - lastTick.current > 110) {
        lastTick.current = now
        audio.hold(p)
      }
    },
    onComplete: handleComplete,
    onCancel: () => {
      progressRef.current = 0
      setUiProgress(0)
    },
  })

  const onPointerDown = (e) => {
    startPt.current = { x: e.clientX, y: e.clientY }
    handlers.onPointerDown(e)
  }
  const onPointerMove = (e) => {
    if (!holding) return
    const dx = e.clientX - startPt.current.x
    const dy = e.clientY - startPt.current.y
    if (Math.hypot(dx, dy) > 14) cancel() // a swipe, not a hold — let the carousel take it
  }

  const pct = goalPct(habit)
  const repsCapped = Math.min(habit.reps, GOAL)

  return (
    <motion.div
      className="flex h-full w-full flex-col select-none-deep"
      animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.42 }}
    >
      {/* ── Hero 3D viewport (the completion surface) ───────────────────── */}
      <div className="relative min-h-0 flex-1">
        {active ? (
          <HabitScene habit={habit} def={def} progressRef={progressRef} burst={burst} active={active} />
        ) : (
          // Off-screen cards skip the WebGL context entirely (keeps GPU load
          // and context count down); a skin-tinted gradient stands in.
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(80% 60% at 50% 40%, rgb(var(--c-accent) / 0.12), rgb(var(--c-base)))' }}
          />
        )}

        {/* Emoji + type badge, floating top-left (clears the app header) */}
        <div className="pointer-events-none absolute left-5 top-16 flex items-center gap-2">
          <span className="text-3xl drop-shadow-lg">{habit.emoji || '⛰️'}</span>
          <span className="rounded-full bg-surface/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted backdrop-blur">
            {habit.type === 'single' ? 'Daily' : habit.type === 'multi' ? 'Multi' : 'Progress'}
          </span>
        </div>

        {mastered && (
          <div className="pointer-events-none absolute right-5 top-16 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent backdrop-blur">
            ✦ Summit reached
          </div>
        )}

        {/* Pointer capture surface for the hold gesture (active card only) */}
        {active && (
        <div
          className="absolute inset-0 grid touch-none place-items-center"
          style={{ cursor: doneToday ? 'default' : 'pointer' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerLeave={handlers.onPointerLeave}
          onPointerCancel={handlers.onPointerCancel}
        >
          {/* Charging ring — appears as you hold */}
          <div
            className="relative grid place-items-center transition-opacity duration-200"
            style={{ opacity: holding ? 1 : 0 }}
          >
            {holding && (
              <span className="absolute h-28 w-28 rounded-full border-2 border-accent/40 animate-pulse-ring" />
            )}
            <ProgressRing value={uiProgress} size={112} stroke={6} glow>
              <span className="text-sm font-semibold text-accent">
                {Math.round(uiProgress * 100)}%
              </span>
            </ProgressRing>
          </div>

          {/* Idle hint */}
          <AnimatePresence>
            {!holding && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute bottom-4 rounded-full bg-surface/60 px-4 py-2 text-xs font-medium text-muted backdrop-blur"
              >
                {doneToday ? 'Logged today ✓ — see you tomorrow' : 'Press & hold to log a rep'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>

      {/* ── Info panel ──────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-3 mb-3 rounded-4xl border border-white/5 bg-surface/80 p-5 shadow-card backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold leading-tight text-ink">{habit.title}</h2>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
              {streak > 0 ? (
                <span className="inline-flex items-center gap-1 text-accent">
                  <FlameIcon width={14} height={14} /> {streak}-day streak
                </span>
              ) : (
                <span>No active streak — start one</span>
              )}
              <button
                onClick={handleDelete}
                aria-label="Delete habit"
                className="ml-auto rounded-full p-2 text-muted/60 transition-colors hover:text-red-400 active:scale-90"
              >
                <TrashIcon width={15} height={15} />
              </button>
            </div>
          </div>

          <ProgressRing value={pct} size={76} stroke={7}>
            <div className="text-center leading-none">
              <div className="text-lg font-bold text-ink">{repsCapped}</div>
              <div className="text-[10px] text-muted">/ {GOAL}</div>
            </div>
          </ProgressRing>
        </div>

        {/* 60-rep climb bar */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>The climb to mastery</span>
            <span>{Math.round(pct * 100)}%</span>
          </div>
        </div>

        {/* Per-session numeric progress (progress habits only) */}
        {habit.type === 'progress' && (
          <div className="mt-3 rounded-2xl bg-elevated/60 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">This session</span>
              <span className="font-semibold text-ink">
                {Math.round(habit.sessionValue || 0)} / {habit.target} {habit.unit}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${sessionPct(habit) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
