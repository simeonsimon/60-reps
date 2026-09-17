import { GOAL, startOfDay, isScheduledOn, currentStreak, WEEKDAY_LABELS } from '../habits.js'

// Pure analytics over a habit's completion history. Everything here is
// deterministic math on {t, amount} events — no store, no React — so the
// panel can memoize one analyzeHabit()/analyzePortfolio() call per render.

const DAY = 86400000

// ── Date helpers ────────────────────────────────────────────────────────────
// Day stepping goes through Date#setDate (not ms arithmetic) so DST shifts
// can't drift the cursor into the wrong day.

export function addDays(dayMs, n) {
  const d = new Date(dayMs)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function* eachDay(fromMs, toMs) {
  let cur = startOfDay(fromMs)
  const end = startOfDay(toMs)
  let guard = 0
  while (cur <= end && guard++ < 4000) {
    yield cur
    cur = addDays(cur, 1)
  }
}

export function fmtDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function pctLabel(x) {
  return `${Math.round(x * 100)}%`
}

// ── Primitives ──────────────────────────────────────────────────────────────

// Map of dayStart → reps logged that day.
export function dayCounts(habit) {
  const m = new Map()
  for (const e of habit.history || []) {
    const d = startOfDay(e.t)
    m.set(d, (m.get(d) || 0) + e.amount)
  }
  return m
}

// Portfolio completion for one calendar day. Habits that were not created yet
// and habits scheduled off are both excluded from the denominator.
export function dayCompletion(habits, dayMs, now = Date.now()) {
  const day = startOfDay(dayMs)
  let scheduled = 0
  let hit = 0

  for (const habit of habits) {
    if (day < firstDay(habit, now) || !isScheduledOn(habit, day)) continue
    scheduled++
    if ((dayCounts(habit).get(day) || 0) > 0) hit++
  }

  return {
    scheduled,
    hit,
    pct: scheduled > 0 ? hit / scheduled : 0,
    pending: day === startOfDay(now) && scheduled > 0 && hit < scheduled,
  }
}

export function firstDay(habit, now = Date.now()) {
  let min = habit.createdAt || now
  for (const e of habit.history || []) if (e.t < min) min = e.t
  return startOfDay(min)
}

export function ageDays(habit, now = Date.now()) {
  return Math.max(1, Math.round((startOfDay(now) - firstDay(habit, now)) / DAY) + 1)
}

export function totalReps(habit) {
  return (habit.history || []).reduce((s, e) => s + e.amount, 0)
}

// ── Hit rate over a trailing window ─────────────────────────────────────────
// "Hit" = a scheduled day with at least one rep. Off-days never count against
// the rate, and today only counts once something is logged (the day isn't
// over yet — no guilt at 8am).

export function windowStats(habit, days, now = Date.now()) {
  const counts = dayCounts(habit)
  const today = startOfDay(now)
  const from = Math.max(firstDay(habit, now), addDays(today, -(days - 1)))
  let scheduled = 0
  let hit = 0
  let reps = 0
  let activeDays = 0
  let spanDays = 0
  for (const d of eachDay(from, today)) {
    spanDays++
    const c = counts.get(d) || 0
    reps += c
    if (c > 0) activeDays++
    if (d === today && c === 0) continue // pending, not a miss yet
    if (isScheduledOn(habit, d)) {
      scheduled++
      if (c > 0) hit++
    }
  }
  return { spanDays, scheduled, hit, reps, activeDays, rate: scheduled > 0 ? hit / scheduled : null }
}

// ── Streaks ─────────────────────────────────────────────────────────────────
// Longest run ever, with the same rules as currentStreak: off-days are
// neutral (skipped) but active off-days extend the run; today pending is
// neutral too.

export function longestStreak(habit, now = Date.now()) {
  const counts = dayCounts(habit)
  if (counts.size === 0) return 0
  const today = startOfDay(now)
  let best = 0
  let run = 0
  for (const d of eachDay(firstDay(habit, now), today)) {
    const c = counts.get(d) || 0
    if (c > 0) {
      run++
      if (run > best) best = run
    } else if (!isScheduledOn(habit, d) || d === today) {
      continue
    } else {
      run = 0
    }
  }
  return best
}

// ── Weekday profile ─────────────────────────────────────────────────────────
// Per weekday over the last ~12 weeks: how often did that weekday happen,
// how often was it hit, how many reps landed on it. best/worst only consider
// scheduled weekdays with enough occurrences to mean something.

export function weekdayProfile(habit, now = Date.now(), windowDays = 84) {
  const counts = dayCounts(habit)
  const today = startOfDay(now)
  const from = Math.max(firstDay(habit, now), addDays(today, -(windowDays - 1)))
  const hasSchedule = habit.days && habit.days.length > 0 && habit.days.length < 7
  const schedSet = hasSchedule ? new Set(habit.days) : null

  const rows = Array.from({ length: 7 }, (_, wd) => ({
    wd,
    label: WEEKDAY_LABELS[wd],
    scheduled: !schedSet || schedSet.has(wd),
    occurrences: 0,
    activeDays: 0,
    reps: 0,
    rate: null,
  }))

  let weekendHit = 0
  let weekendOcc = 0
  let weekdayHit = 0
  let weekdayOcc = 0

  for (const d of eachDay(from, today)) {
    const c = counts.get(d) || 0
    if (d === today && c === 0) continue // pending day, don't judge it
    const wd = new Date(d).getDay()
    const row = rows[wd]
    row.occurrences++
    row.reps += c
    if (c > 0) row.activeDays++
    if (row.scheduled) {
      const isWeekend = wd === 0 || wd === 6
      if (isWeekend) {
        weekendOcc++
        if (c > 0) weekendHit++
      } else {
        weekdayOcc++
        if (c > 0) weekdayHit++
      }
    }
  }

  for (const r of rows) r.rate = r.occurrences > 0 ? r.activeDays / r.occurrences : null

  const eligible = rows.filter((r) => r.scheduled && r.occurrences >= 3 && r.rate !== null)
  let best = null
  let worst = null
  for (const r of eligible) {
    if (!best || r.rate > best.rate) best = r
    if (!worst || r.rate < worst.rate) worst = r
  }

  return {
    rows,
    best,
    worst,
    weekendRate: weekendOcc >= 4 ? weekendHit / weekendOcc : null,
    weekdayRate: weekdayOcc >= 8 ? weekdayHit / weekdayOcc : null,
  }
}

// ── Time-of-day profile ─────────────────────────────────────────────────────

export const DAY_PARTS = [
  { id: 'morning', label: 'Morning', emoji: '🌅', hint: '5am – 12pm' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️', hint: '12pm – 5pm' },
  { id: 'evening', label: 'Evening', emoji: '🌆', hint: '5pm – 10pm' },
  { id: 'night', label: 'Night', emoji: '🌙', hint: '10pm – 5am' },
]

export function dayParts(habit) {
  const parts = DAY_PARTS.map((p) => ({ ...p, reps: 0, share: 0 }))
  let total = 0
  for (const e of habit.history || []) {
    const h = new Date(e.t).getHours()
    const idx = h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3
    parts[idx].reps += e.amount
    total += e.amount
  }
  if (total > 0) for (const p of parts) p.share = p.reps / total
  const top = total > 0 ? parts.reduce((a, b) => (b.reps > a.reps ? b : a)) : null
  return { parts, total, top }
}

// ── Pace & momentum ─────────────────────────────────────────────────────────

export function paceStats(habit, now = Date.now()) {
  const counts = dayCounts(habit)
  const today = startOfDay(now)
  const sumRange = (fromOff, toOff) => {
    let s = 0
    for (const d of eachDay(addDays(today, fromOff), addDays(today, toOff))) s += counts.get(d) || 0
    return s
  }
  const last7 = sumRange(-6, 0)
  const prev7 = sumRange(-13, -7)
  const last28 = sumRange(-27, 0)
  const age = ageDays(habit, now)
  const total = totalReps(habit)
  const perWeekLife = total / Math.max(1, age / 7)
  const momentum = prev7 > 0 ? (last7 - prev7) / prev7 : last7 > 0 ? 1 : 0
  return { last7, prev7, last28, momentum, perWeekLife, totalReps: total, ageDays: age }
}

// Monday-aligned weekly rep totals, oldest → newest. Accepts one habit or an
// array (portfolio view).
export function weeklySeries(habitOrHabits, weeks = 8, now = Date.now()) {
  const list = Array.isArray(habitOrHabits) ? habitOrHabits : [habitOrHabits]
  const today = startOfDay(now)
  const monOffset = (new Date(today).getDay() + 6) % 7
  const thisMonday = addDays(today, -monOffset)
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    start: addDays(thisMonday, -7 * (weeks - 1 - i)),
    reps: 0,
  }))
  const t0 = buckets[0].start
  for (const h of list) {
    for (const e of h.history || []) {
      const d = startOfDay(e.t)
      if (d < t0) continue
      const idx = Math.min(weeks - 1, Math.floor(Math.round((d - t0) / DAY) / 7))
      buckets[idx].reps += e.amount
    }
  }
  return buckets
}

// ── Forecast ────────────────────────────────────────────────────────────────
// Blend the 4-week pace (70%) with the lifetime pace (30%) so one hot or
// dead week doesn't whipsaw the summit date.

export function masteryDate(habit) {
  let cum = 0
  const sorted = [...(habit.history || [])].sort((a, b) => a.t - b.t)
  for (const e of sorted) {
    cum += e.amount
    if (cum >= GOAL) return e.t
  }
  return null
}

export function forecast(habit, now = Date.now()) {
  if (habit.reps >= GOAL) return { done: true, summitAt: masteryDate(habit), bonus: habit.reps - GOAL }
  const { last28, perWeekLife, ageDays: age } = paceStats(habit, now)
  const daily28 = last28 / Math.min(28, Math.max(1, age))
  const dailyLife = perWeekLife / 7
  const rate = daily28 > 0 ? 0.7 * daily28 + 0.3 * dailyLife : dailyLife
  const remaining = GOAL - habit.reps
  if (!rate || rate <= 0) return { done: false, stalled: true, remaining }
  const daysLeft = Math.ceil(remaining / rate)
  if (daysLeft > 730) return { done: false, stalled: true, remaining }
  return {
    done: false,
    stalled: false,
    remaining,
    daysLeft,
    eta: addDays(startOfDay(now), daysLeft),
    perWeek: rate * 7,
  }
}

// ── Records ─────────────────────────────────────────────────────────────────

export function records(habit, now = Date.now()) {
  const counts = dayCounts(habit)
  let bestDay = null
  for (const [date, reps] of counts) {
    if (!bestDay || reps > bestDay.reps || (reps === bestDay.reps && date > bestDay.date)) {
      bestDay = { date, reps }
    }
  }
  const days = [...counts.keys()].sort((a, b) => a - b)
  let longestPause = 0
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((days[i] - days[i - 1]) / DAY) - 1
    if (gap > longestPause) longestPause = gap
  }
  const activeDays = days.length
  const total = totalReps(habit)
  const sinceLast = habit.lastCompletedAt
    ? Math.round((startOfDay(now) - startOfDay(habit.lastCompletedAt)) / DAY)
    : null
  return {
    bestDay,
    longestPause,
    activeDays,
    avgPerActive: activeDays > 0 ? total / activeDays : 0,
    sinceLast,
  }
}

// ── Consistency score ───────────────────────────────────────────────────────
// Explainable 0–100 composite: 60% four-week hit rate, 25% current streak
// (saturates at 10 days), 15% week-over-week trend.

export function consistencyScore(habit, now = Date.now()) {
  const w = windowStats(habit, 28, now)
  const streak = currentStreak(habit, now)
  const { momentum } = paceStats(habit, now)
  const rate = w.rate ?? 0
  const streakFactor = Math.min(1, streak / 10)
  const trendFactor = 0.5 + Math.max(-1, Math.min(1, momentum)) / 2
  const score = Math.max(0, Math.min(100, Math.round(100 * (0.6 * rate + 0.25 * streakFactor + 0.15 * trendFactor))))
  const label =
    score >= 85 ? 'Rock solid' : score >= 65 ? 'Strong' : score >= 45 ? 'Building' : score >= 20 ? 'Fragile' : 'Dormant'
  return { score, label }
}
