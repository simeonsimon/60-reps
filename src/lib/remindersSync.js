// Merge logic for the nightly Apple Reminders sweep.
//
// A Shortcut drops one plain-text file per day into `inbox/`, named
// `<YYYY-MM-DD>--<epoch>.txt`, holding the titles of every reminder completed
// on that date (one per line, repeated if ticked more than once). Unique
// filenames mean the Shortcut only ever PUTs — no SHA, no read-modify-write —
// which is the fiddly part to build on iOS.
//
// Everything here is pure so the reconcile can be reasoned about (and tested)
// without touching the network.

import { applyCompletion, startOfDay } from './habits.js'

const FILE_RE = /^(\d{4}-\d{2}-\d{2})--(\d+)\.txt$/
const TICK_RETENTION_DAYS = 90

// Strip accents, emoji and punctuation so "Leer 20 páginas 📚" from Reminders
// matches the habit titled "Leer 20 paginas". Emoji and variation selectors
// are neither letters nor numbers, so the punctuation pass removes them too.
export function normalizeTitle(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function splitTitles(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

// Reminders logged at, say, 23:55 land in the *next* night's sweep, so every
// run re-reports yesterday as well. Keeping only the newest file per date makes
// that overlap self-healing instead of duplicating.
export function parseSweepFiles(files) {
  const latest = new Map()
  for (const file of files) {
    const m = FILE_RE.exec(file.name || '')
    if (!m) continue
    const [, date, epoch] = m
    const prev = latest.get(date)
    if (prev && prev.epoch >= Number(epoch)) continue
    latest.set(date, { epoch: Number(epoch), titles: splitTitles(file.text) })
  }
  const byDate = {}
  for (const [date, v] of latest) byDate[date] = v.titles
  return byDate
}

// Midday on the swept date, so backfilled reps land on the right day for
// streaks and the heatmap. Clamped so "today" never gets a future timestamp.
function tickTimestamp(date, now) {
  const [y, m, d] = date.split('-').map(Number)
  return Math.min(new Date(y, m - 1, d, 12, 0, 0, 0).getTime(), now)
}

function countOnDay(habit, ts) {
  const day = startOfDay(ts)
  return (habit.history || []).filter((e) => startOfDay(e.t) === day).length
}

function pruneTicks(ticks, now) {
  const cutoff = startOfDay(now) - TICK_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const out = {}
  for (const [key, count] of Object.entries(ticks)) {
    const date = key.split('|')[0]
    const [y, m, d] = date.split('-').map(Number)
    if (new Date(y, m - 1, d).getTime() >= cutoff) out[key] = count
  }
  return out
}

/**
 * Fold a parsed sweep into the current habits.
 *
 * Idempotent in two independent ways, because the sweep re-reports days and the
 * same day can also be tapped inside the app:
 *   - `profile.syncedTicks[<date>|<habitId>]` records how many ticks that day
 *     has already contributed, so replaying a file is a no-op;
 *   - for single/multi habits the existing history for that day is also used as
 *     a floor, so a rep tapped in-app is never counted twice.
 * Progress habits can't use the history floor — their history holds earned reps,
 * not the individual steps a tick represents — so they rely on syncedTicks.
 *
 * Returns the new habits array plus a summary for the Settings UI.
 */
export function reconcileSweep(state, byDate, now = Date.now()) {
  const index = new Map()
  for (const h of state.habits) {
    const key = normalizeTitle(h.title)
    if (key) index.set(key, h.id)
  }

  const habits = state.habits.slice()
  const syncedTicks = { ...(state.profile?.syncedTicks || {}) }
  const unmatched = new Map()
  let appliedReps = 0
  let appliedTicks = 0

  // Oldest date first so backfilled history stays in order.
  for (const date of Object.keys(byDate).sort()) {
    const counts = new Map()
    for (const raw of byDate[date]) {
      const key = normalizeTitle(raw)
      if (!key) continue
      if (!index.has(key)) {
        unmatched.set(key, raw.trim())
        continue
      }
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    const ts = tickTimestamp(date, now)
    for (const [key, rawCount] of counts) {
      const id = index.get(key)
      const i = habits.findIndex((h) => h.id === id)
      if (i < 0) continue

      let habit = habits[i]
      // A "single" habit is one rep a day however many times it was ticked.
      const count = habit.type === 'single' ? Math.min(rawCount, 1) : rawCount
      const tickKey = `${date}|${id}`
      const already = syncedTicks[tickKey] || 0
      const floor = habit.type === 'progress' ? already : Math.max(already, countOnDay(habit, ts))
      syncedTicks[tickKey] = Math.max(already, count)

      const prevLast = habit.lastCompletedAt
      for (let n = 0; n < count - floor; n++) {
        const { habit: next, meta } = applyCompletion(habit, ts)
        if (meta.blocked) break
        habit = next
        appliedReps += meta.repsGained
        appliedTicks++
      }
      if (habit === habits[i]) continue

      habits[i] = {
        ...habit,
        // Backfilling an older day must not drag the last-completed marker back.
        lastCompletedAt: Math.max(prevLast || 0, habit.lastCompletedAt || 0) || null,
        history: [...habit.history].sort((a, b) => a.t - b.t),
      }
    }
  }

  return {
    habits,
    syncedTicks: pruneTicks(syncedTicks, now),
    appliedReps,
    appliedTicks,
    unmatched: [...unmatched.values()],
  }
}
