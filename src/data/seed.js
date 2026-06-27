import { mulberry32, hashSeed } from '../lib/rng.js'

export const GOAL = 60 // The "60 Reps" mastery goal. Every habit climbs to 60.

const DAY = 24 * 60 * 60 * 1000

// Build a plausible back-dated completion history that sums to `reps`, spread
// over slightly more days than there are reps so there are natural gaps
// (missed days pause the climb — they never reset it). Deterministic per title.
function buildHistory(title, reps, now) {
  const rand = mulberry32(hashSeed(title))
  const span = Math.max(reps + 4, Math.round(reps * 1.6) + 3)
  const events = []
  let remaining = reps
  // Walk backwards from `span` days ago up to today, dropping reps onto days.
  for (let d = span; d >= 0 && remaining > 0; d--) {
    // ~62% chance of a logged day; weight recent days slightly higher.
    const active = rand() < 0.62
    if (!active) continue
    const dayStart = now - d * DAY
    // Most habits log once/day; occasionally a double session.
    const count = rand() < 0.18 ? 2 : 1
    for (let i = 0; i < count && remaining > 0; i++) {
      const jitter = Math.floor(rand() * 12 * 60 * 60 * 1000) + 7 * 60 * 60 * 1000
      events.push({ t: dayStart + jitter, amount: 1 })
      remaining--
    }
  }
  // Any leftover reps (if the random walk under-filled) land on recent days.
  let d = 1
  while (remaining > 0) {
    events.push({ t: now - d * DAY + 9 * 60 * 60 * 1000, amount: 1 })
    remaining--
    d++
  }
  events.sort((a, b) => a.t - b.t)
  return events
}

function makeHabit(partial, now) {
  const history = buildHistory(partial.title, partial.reps, now)
  return {
    createdAt: history.length ? history[0].t : now,
    sessionValue: 0,
    lastCompletedAt: history.length ? history[history.length - 1].t : null,
    history,
    ...partial,
  }
}

// The three seed habits from the spec.
export function seedHabits(now = Date.now()) {
  return [
    makeHabit(
      {
        id: 'free-throws',
        title: '100 Free Throws',
        type: 'progress',
        target: 100,
        step: 20, // each long-press logs 20 throws toward the session target
        unit: 'throws',
        reps: 14,
        // Demonstrate a partial in-progress session (like the "45 / 60" example).
        sessionValue: 40,
        emoji: '🏀',
      },
      now,
    ),
    makeHabit(
      {
        id: 'edexcel-chem',
        title: 'Edexcel Chemistry Past Paper',
        type: 'single',
        reps: 42,
        emoji: '🧪',
      },
      now,
    ),
    makeHabit(
      {
        id: 'helmet',
        title: 'Clean Motorbike Helmet',
        type: 'single',
        reps: 3,
        emoji: '🏍️',
      },
      now,
    ),
  ]
}

export function freshProfile() {
  return {
    premium: true, // showcase build — premium features visible; toggle in Settings
    skin: 'normal',
    sound: true,
    overrideMute: false, // "Super! Boring" override of system mute
    achievements: {}, // { [id]: unlockedAt }
    stats: { totalTaps: 0 },
  }
}
