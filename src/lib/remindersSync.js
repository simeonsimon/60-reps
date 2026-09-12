// Merge logic for the Apple Reminders sweep.
//
// A Shortcut drops one plain-text file per run into `inbox/`, named
// `sweep-<stamp>.txt`, holding one line per completed reminder:
//
//     2026-09-12|Gym
//     2026-09-12|Gym
//     2026-09-11|Leer 20 paginas
//
// Each line carries its own date, so the Shortcut never has to decide which day
// is "today" — a comparison that is fiddly on iOS and was the step that kept
// silently matching nothing. It dumps what it found; the grouping happens here.
//
// The older `<YYYY-MM-DD>--<stamp>.txt` layout (titles only, date in the
// filename) is still read so existing files are not orphaned.
//
// Unique filenames mean the Shortcut only ever PUTs — no SHA, no
// read-modify-write — which is the fiddly part to build on iOS.
//
// Everything here is pure so the reconcile can be reasoned about (and tested)
// without touching the network.

import { applyCompletion, startOfDay } from './habits.js'

const RUN_FILE_RE = /^sweep-(\d+)\.txt$/
const DAY_FILE_RE = /^(\d{4}-\d{2}-\d{2})--(\d+)\.txt$/
const DATED_LINE_RE = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/
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

// One run's file: `YYYY-MM-DD|Title` per line. Lines that don't carry a date
// are ignored rather than guessed at — a mis-built Shortcut should surface as
// "nothing synced", never as reps credited to the wrong day.
function parseDatedLines(text) {
  const byDate = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = DATED_LINE_RE.exec(line.trim())
    if (!m) continue
    const date = m[1]
    const title = m[2].trim()
    if (!title) continue
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(title)
  }
  return byDate
}

function splitTitles(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

// A day can appear in several runs — the sweep re-reports recent completions
// every time it runs. The newest file that mentions a day wins for that day,
// which makes the overlap self-healing instead of cumulative.
export function parseSweepFiles(files) {
  const runs = []
  for (const file of files) {
    const name = file.name || ''
    const run = RUN_FILE_RE.exec(name)
    if (run) {
      runs.push({ stamp: Number(run[1]), byDate: parseDatedLines(file.text) })
      continue
    }
    const day = DAY_FILE_RE.exec(name)
    if (day) {
      runs.push({ stamp: Number(day[2]), byDate: { [day[1]]: splitTitles(file.text) } })
    }
  }

  runs.sort((a, b) => a.stamp - b.stamp)
  const byDate = {}
  for (const run of runs) {
    for (const entry of Object.entries(run.byDate)) byDate[entry[0]] = entry[1]
  }
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
