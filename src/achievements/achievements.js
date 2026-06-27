import { currentStreak, isSameDay } from '../lib/habits.js'

// Stylized milestone badges. `glyph` is drawn as a vector badge in the UI.
export const ACHIEVEMENTS = [
  { id: 'first-step', name: 'First Step', desc: 'Log your very first rep.', glyph: 'flag' },
  { id: 'combo', name: 'Combo', desc: 'Log two reps within a couple of seconds.', glyph: 'bolt', hidden: true },
  { id: 'night-owl', name: 'Night Owl', desc: 'Log a rep around midnight.', glyph: 'moon', hidden: true },
  { id: 'early-bird', name: 'Early Bird', desc: 'Log a rep before 6 AM.', glyph: 'sun', hidden: true },
  { id: 'half-way', name: 'Base Camp', desc: 'Reach 30 reps on any habit.', glyph: 'tent' },
  { id: 'summit', name: 'Summit', desc: 'Complete the climb — 60 reps.', glyph: 'peak' },
  { id: 'streak-7', name: 'Seven-Day Ridge', desc: 'Hold a 7-day streak.', glyph: 'fire' },
  { id: 'collector', name: 'Trailhead', desc: 'Track three habits at once.', glyph: 'compass' },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))

/**
 * Given the post-completion state and the event, return the ids of any
 * achievements that are now satisfied. The caller filters out already-unlocked
 * ones before awarding, so this can return the full set each time.
 *
 * event: { habit, meta, now, gapMs }
 *   habit  — the habit AFTER the completion was applied
 *   meta   — { repsGained, sessionFilled, blocked }
 *   gapMs  — ms since the previous completion of any habit (for combo)
 */
export function evaluate(state, event) {
  const out = new Set()
  const { habit, meta, now, gapMs } = event

  if (meta.repsGained > 0) {
    if (habit.reps === meta.repsGained && habit.reps >= 1) {
      // The habit went from 0 to its first rep(s) in this event.
      // (reps equals what was just gained → it started at 0.)
      out.add('first-step')
    }
    if (habit.reps >= 30) out.add('half-way')
    if (habit.reps >= 60) out.add('summit')

    const hour = new Date(now).getHours()
    const minute = new Date(now).getMinutes()
    if ((hour === 23 && minute >= 30) || (hour === 0 && minute <= 30)) out.add('night-owl')
    if (hour < 6) out.add('early-bird')

    if (typeof gapMs === 'number' && gapMs <= 1600) out.add('combo')

    if (currentStreak(habit, now) >= 7) out.add('streak-7')
  }

  if (state.habits.length >= 3) out.add('collector')

  return [...out]
}

// Convenience used on app load so the "Trailhead" badge reflects seed data.
export function evaluatePassive(state) {
  const out = new Set()
  if (state.habits.length >= 3) out.add('collector')
  for (const h of state.habits) {
    if (h.reps >= 30) out.add('half-way')
    if (h.reps >= 60) out.add('summit')
    if (currentStreak(h) >= 7) out.add('streak-7')
  }
  return [...out]
}

// Re-exported so other modules can reuse the same day check if needed.
export { isSameDay }
