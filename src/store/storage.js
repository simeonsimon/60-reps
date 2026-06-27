import { seedHabits, freshProfile } from '../data/seed.js'

const KEY = 'sixtyreps.v1'

// Load persisted state, seeding on first run. Falls back gracefully if
// localStorage is unavailable or the payload is corrupt.
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const seeded = { habits: seedHabits(), profile: freshProfile(), activeIndex: 0 }
      saveState(seeded)
      return seeded
    }
    const parsed = JSON.parse(raw)
    return {
      habits: Array.isArray(parsed.habits) ? parsed.habits : seedHabits(),
      profile: { ...freshProfile(), ...(parsed.profile || {}) },
      activeIndex: parsed.activeIndex || 0,
    }
  } catch (err) {
    console.warn('[60reps] failed to load state, reseeding', err)
    return { habits: seedHabits(), profile: freshProfile(), activeIndex: 0 }
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[60reps] failed to save state', err)
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
