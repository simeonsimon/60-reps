import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHabits } from '../store/StoreProvider.jsx'
import { audio } from '../audio/AudioEngine.js'
import { useLongPress } from '../hooks/useLongPress.js'
import { habitHeadline } from '../lib/analytics/insights.js'
import { HabitHeadline } from './analytics/primitives.jsx'
import ChargeStage from './ChargeStage.jsx'
import ProgressRing from './ProgressRing.jsx'
import { FlameIcon, TrashIcon } from './icons.jsx'
import {
  GOAL,
  goalPct,
  completedToday,
  sessionPct,
  currentStreak,
  isMastered,
  isScheduledToday,
  daysLabel,
} from '../lib/habits.js'

export default function HabitCard({ habit, active, onUnlock, onOpenStats }) {
  const { complete, removeHabit, habits, setActive } = useHabits()
  const progressRef = useRef(0)
  // The stage and the info panel are painted by mutating style through refs, so
  // the hold gesture never re-renders the card mid-frame — key for smooth iOS
  // holds, and the reason the charge visuals can run at full frame rate.
  const stageRef = useRef(null)
  const panelRef = useRef(null)
  const [shake, setShake] = useState(false)
  const lastTick = useRef(0)
  const startPt = useRef({ x: 0, y: 0 })

  const doneToday = habit.type === 'single' && completedToday(habit)
  const mastered = isMastered(habit)
  const streak = currentStreak(habit)
  const restDay = !isScheduledToday(habit)
  const hasSchedule = daysLabel(habit) !== 'Every day'
  const anchor = habit.anchorId ? habits.find((h) => h.id === habit.anchorId) : null
  const headline = active ? habitHeadline(habit) : null

  function paintHold(p) {
    progressRef.current = p
    stageRef.current?.paint(p)
    // Focus pull: the info panel recedes while you charge, so the surface under
    // your thumb becomes the only thing in the room. Compositor-only — no blur,
    // which would cost too much stacked on the panel's existing backdrop.
    if (panelRef.current) {
      panelRef.current.style.transform = `scale(${1 - p * 0.02}) translateY(${p * 5}px)`
      panelRef.current.style.opacity = String(1 - p * 0.3)
    }
  }

  function settleHold() {
    progressRef.current = 0
    stageRef.current?.rest()
    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 320ms var(--ease-out-quart), opacity 320ms var(--ease-out-quart)'
      panelRef.current.style.transform = 'scale(1) translateY(0)'
      panelRef.current.style.opacity = '1'
    }
  }

  function handleComplete() {
    settleHold()
    const prevReps = habit.reps
    const res = complete(habit.id)
    if (res.meta.blocked) {
      audio.blocked()
      setShake(true)
      setTimeout(() => setShake(false), 420)
      return
    }
    if (res.meta.repsGained > 0) {
      stageRef.current?.fire()
      if (prevReps < GOAL && prevReps + res.meta.repsGained >= GOAL) audio.summit()
      else audio.complete()
    } else {
      audio.tick() // progress added toward the session, no full rep yet
    }
    if (res.unlocked?.length) {
      audio.achievement()
      onUnlock?.(res.unlocked)
    }
    // Habit stacking: after banking a rep, glide to the habit chained onto
    // this one (if it still needs doing today) so the next action is teed up.
    if (res.meta.repsGained > 0) {
      const nextIdx = habits.findIndex((h) => h.anchorId === habit.id && !completedToday(h))
      if (nextIdx !== -1 && habits[nextIdx].id !== habit.id) {
        setTimeout(() => setActive(nextIdx), 1200)
      }
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
    duration: 1600,
    disabled: doneToday,
    onStart: () => audio.resume(),
    onProgress: (p) => {
      paintHold(p)
      const now = performance.now()
      if (now - lastTick.current > 110) {
        lastTick.current = now
        audio.hold(p)
      }
    },
    onComplete: handleComplete,
    onCancel: settleHold,
  })

  const onPointerDown = (e) => {
    startPt.current = { x: e.clientX, y: e.clientY }
    // Anchor the charge to the finger before the first frame paints.
    stageRef.current?.origin(e.clientX, e.clientY)
    stageRef.current?.arm()
    if (panelRef.current) panelRef.current.style.transition = 'none'
    handlers.onPointerDown(e)
  }
  const onPointerMove = (e) => {
    if (!holding) return
    const dx = e.clientX - startPt.current.x
    const dy = e.clientY - startPt.current.y
    if (Math.hypot(dx, dy) > 14) {
      cancel() // a swipe, not a hold — let the carousel take it
      settleHold()
    }
  }

  const pct = goalPct(habit)
  const repsCapped = Math.min(habit.reps, GOAL)

  return (
    <motion.div
      className="flex h-full w-full flex-col select-none-deep"
      animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.42 }}
    >
      {/* ── The completion surface ──────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
        <ChargeStage ref={stageRef} />

        {/* Emoji + type badge, floating top-left (clears the app header) */}
        <div
          className="pointer-events-none absolute left-5 flex items-center gap-2"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
        >
          <span className="text-3xl drop-shadow-lg">{habit.emoji || '⛰️'}</span>
          <span className="rounded-full bg-surface/70 px-2.5 py-1 text-xs2 font-medium uppercase tracking-wide text-muted backdrop-blur">
            {habit.type === 'single' ? 'Daily' : habit.type === 'multi' ? 'Multi' : 'Progress'}
          </span>
          {hasSchedule && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs2 font-medium backdrop-blur ${
                restDay ? 'bg-surface/70 text-muted' : 'bg-accent-soft text-accent'
              }`}
            >
              {restDay ? '💤 Rest day' : daysLabel(habit)}
            </span>
          )}
          {anchor && (
            <span className="rounded-full bg-surface/70 px-2.5 py-1 text-xs2 font-medium text-muted backdrop-blur">
              ⛓ after {anchor.emoji || ''} {anchor.title.length > 14 ? anchor.title.slice(0, 14) + '…' : anchor.title}
            </span>
          )}
        </div>

        {mastered && (
          <div
            className="pointer-events-none absolute right-5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent backdrop-blur"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
          >
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
          {/* Idle hint. Progress feedback now lives on the stage, under the
              thumb — this is only the resting invitation. */}
          <AnimatePresence>
            {!holding && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="breathe pointer-events-none absolute bottom-4 rounded-full bg-surface/60 px-4 py-2 text-xs font-medium text-muted backdrop-blur"
              >
                {doneToday
                  ? 'Logged today ✓ — see you tomorrow'
                  : restDay
                    ? 'Rest day 💤 — bonus reps still count'
                    : anchor && !completedToday(anchor)
                      ? `First: ${anchor.title} — then hold to log this`
                      : 'Press & hold to log a rep'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>

      {/* ── Info panel ──────────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        className="relative z-10 mx-3 mb-3 origin-bottom rounded-4xl border border-line/5 bg-surface/80 p-5 shadow-card backdrop-blur-xl"
      >
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
            <HabitHeadline
              headline={headline}
              onClick={onOpenStats ? () => onOpenStats(habit.id) : undefined}
              className="mt-1.5"
            />
          </div>

          <ProgressRing value={pct} size={76} stroke={7}>
            <div className="text-center leading-none">
              <div className="text-lg font-bold text-ink">{repsCapped}</div>
              <div className="text-2xs text-muted">/ {GOAL}</div>
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
          <div className="mt-1.5 flex justify-between text-xs2 text-muted">
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
