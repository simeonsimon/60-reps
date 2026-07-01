import { GOAL } from '../data/seed.js'

export { GOAL }

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

export function startOfDay(t) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function isSameDay(a, b) {
  return startOfDay(a) === startOfDay(b)
}

// Reps counted toward the 60 goal (the climb can visually continue past 60,
// but the goal ring caps at 60).
export function repsToGoal(habit) {
  return clamp(habit.reps, 0, GOAL)
}

export function goalPct(habit) {
  return clamp(habit.reps / GOAL, 0, 1)
}

export function isMastered(habit) {
  return habit.reps >= GOAL
}

export function completedToday(habit, now = Date.now()) {
  return !!habit.lastCompletedAt && isSameDay(habit.lastCompletedAt, now)
}

// ── Scheduled days ──────────────────────────────────────────────────────────
// habit.days: array of JS weekday numbers (0 = Sunday). Absent/empty/all-7
// means the habit runs every day. Off-days never count as misses.

// Monday-first display order for pickers; labels index by getDay().
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function isScheduledOn(habit, t) {
  if (!habit.days || habit.days.length === 0 || habit.days.length >= 7) return true
  return habit.days.includes(new Date(t).getDay())
}

export function isScheduledToday(habit, now = Date.now()) {
  return isScheduledOn(habit, now)
}

// "Every day" / "Mon · Wed · Fri" — for cards and pickers.
export function daysLabel(habit) {
  if (!habit.days || habit.days.length === 0 || habit.days.length >= 7) return 'Every day'
  return WEEKDAY_ORDER.filter((d) => habit.days.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(' · ')
}

// Fraction of the current numeric session (progress habits only).
export function sessionPct(habit) {
  if (habit.type !== 'progress' || !habit.target) return 0
  return clamp((habit.sessionValue || 0) / habit.target, 0, 1)
}

// Current streak in days (consecutive days with at least one logged rep,
// counting back from today or yesterday). A missed day pauses but the streak
// simply reflects the current run — history is never wiped. Days the habit
// isn't scheduled on are skipped entirely: they never break a streak, but a
// bonus rep logged on one still counts toward it.
export function currentStreak(habit, now = Date.now()) {
  if (!habit.history || habit.history.length === 0) return 0
  const days = new Set(habit.history.map((e) => startOfDay(e.t)))
  const DAY = 24 * 60 * 60 * 1000
  let cursor = startOfDay(now)
  if (!days.has(cursor)) cursor -= DAY // allow today to be empty so far
  let streak = 0
  let guard = 0
  while (guard++ < 3700) {
    if (days.has(cursor)) {
      streak++
      cursor -= DAY
    } else if (!isScheduledOn(habit, cursor)) {
      cursor -= DAY // off-day with no bonus rep — neutral, keep walking
    } else {
      break // a scheduled day with nothing logged ends the run
    }
  }
  return streak
}

/**
 * Apply one completion interaction to a habit. Pure: returns a new habit plus
 * meta describing what happened, so the UI can fire effects (particles, audio,
 * achievements) appropriately.
 *
 * - single: one completion per day. Repeated taps the same day are no-ops.
 * - multi:  every completion adds a rep.
 * - progress: adds `step` toward `target`; each full target completes a rep.
 */
export function applyCompletion(habit, now = Date.now()) {
  const before = habit.reps
  let next = { ...habit }
  let repsGained = 0

  if (habit.type === 'single') {
    if (completedToday(habit, now)) {
      return { habit, meta: { repsGained: 0, blocked: true, sessionFilled: false } }
    }
    next.reps = habit.reps + 1
    repsGained = 1
    next.history = [...habit.history, { t: now, amount: 1 }]
    next.lastCompletedAt = now
  } else if (habit.type === 'multi') {
    next.reps = habit.reps + 1
    repsGained = 1
    next.history = [...habit.history, { t: now, amount: 1 }]
    next.lastCompletedAt = now
  } else if (habit.type === 'progress') {
    const step = habit.step || 1
    let value = (habit.sessionValue || 0) + step
    const target = habit.target || 1
    const events = [...habit.history]
    while (value >= target) {
      value -= target
      next.reps = (next.reps ?? habit.reps) + 1
      repsGained++
      events.push({ t: now, amount: 1 })
    }
    next.sessionValue = value
    next.history = events
    if (repsGained > 0) next.lastCompletedAt = now
  }

  return {
    habit: next,
    meta: {
      repsGained,
      blocked: false,
      // sessionFilled => a rep was just earned (drives the big celebration).
      sessionFilled: next.reps > before,
    },
  }
}

export const HABIT_TYPES = [
  { id: 'single', label: 'Single Daily', hint: 'One check-in per day' },
  { id: 'multi', label: 'Multi Daily', hint: 'Log it as many times as you like' },
  { id: 'progress', label: 'Progress', hint: 'Count up to a numeric target' },
]
