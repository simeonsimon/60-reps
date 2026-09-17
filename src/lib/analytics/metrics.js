import { GOAL, startOfDay, isScheduledOn, currentStreak, WEEKDAY_LABELS } from '../habits.js'

// Pure analytics over a habit's completion history. Everything here is
// deterministic math on {t, amount} events — no store, no React — so the
// panel can memoize one analyzeHabit()/analyzePortfolio() call per render.

const DAY = 86400000

// One source of truth for when an analytical read has enough evidence to be
// useful. Every analytics gate below is derived from this table.
export const MIN_N = {
  forecast: { metric: 'reps', want: 3, alsoDays: 4 },
  momentum: { metric: 'prev7Reps', want: 2 },
  hitRate28: { metric: 'scheduled', want: 10 },
  timeOfDay: { metric: 'reps', want: 8 },
  weekdayPattern: { metric: 'days', want: 21 },
  baseline28: { metric: 'days', want: 42 },
  monthOverMonth: { metric: 'months', want: 2 },
}

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

const READINESS_ETA_LIMIT = 730

function daysUntilScheduledReps(habit, missing, now) {
  let left = Math.max(0, Math.ceil(missing))
  if (left === 0) return 0

  const counts = dayCounts(habit)
  const today = startOfDay(now)
  for (let offset = 0; offset <= READINESS_ETA_LIMIT; offset++) {
    const day = addDays(today, offset)
    if (isScheduledOn(habit, day) && (counts.get(day) || 0) === 0) left--
    if (left === 0) return offset
  }
  return null
}

// Projects one rep on each scheduled day without mutating the habit. This is
// deliberately optimistic: the displayed ETA is a best case the user can beat.
function daysUntilWindowSample(habit, id, want, now) {
  const counts = dayCounts(habit)
  const today = startOfDay(now)
  const first = firstDay(habit, now)

  for (let offset = 0; offset <= READINESS_ETA_LIMIT; offset++) {
    const day = addDays(today, offset)
    if (isScheduledOn(habit, day) && (counts.get(day) || 0) === 0) counts.set(day, 1)

    if (id === 'momentum') {
      let reps = 0
      for (const d of eachDay(addDays(day, -13), addDays(day, -7))) reps += counts.get(d) || 0
      if (reps >= want) return offset
      continue
    }

    const from = Math.max(first, addDays(day, -27))
    let scheduled = 0
    for (const d of eachDay(from, day)) {
      const reps = counts.get(d) || 0
      if (d === day && reps === 0) continue
      if (isScheduledOn(habit, d)) scheduled++
    }
    if (scheduled >= want) return offset
  }

  return null
}

// What this habit can and cannot say yet. ETA assumes one rep per scheduled
// day starting today, so it is an honest best case rather than a prediction.
export function readiness(habit, now = Date.now()) {
  const age = ageDays(habit, now)
  const counts = dayCounts(habit)
  const active = [...counts.values()].filter((reps) => reps > 0).length
  const total = totalReps(habit)
  const pace = paceStats(habit, now)
  const w28 = windowStats(habit, 28, now)
  const comparison = compareWindows(habit, 28, now)
  const monthBuckets = monthlySeries(habit, MIN_N.monthOverMonth.want, now)

  const forecastReady = total >= MIN_N.forecast.want && age >= MIN_N.forecast.alsoDays
  const forecastRepEta = daysUntilScheduledReps(habit, MIN_N.forecast.want - total, now)
  const forecastEta = forecastReady
    ? 0
    : forecastRepEta === null
      ? null
      : Math.max(forecastRepEta, MIN_N.forecast.alsoDays - age, 0)

  const momentumReady = pace.prev7 >= MIN_N.momentum.want
  const hitRateReady = w28.scheduled >= MIN_N.hitRate28.want
  const timeOfDayReady = total >= MIN_N.timeOfDay.want
  const weekdayReady = age >= MIN_N.weekdayPattern.want
  const baselineReady = comparison.enoughHistory
  const monthsHave = monthBuckets.filter((month) => month.existed).length
  const monthOverMonthReady = monthsHave >= MIN_N.monthOverMonth.want

  const unlocks = [
    {
      id: 'forecast',
      label: 'Summit forecast',
      ready: forecastReady,
      have: total,
      want: MIN_N.forecast.want,
      etaDays: forecastEta,
    },
    {
      id: 'momentum',
      label: 'Momentum',
      ready: momentumReady,
      have: pace.prev7,
      want: MIN_N.momentum.want,
      etaDays: momentumReady
        ? 0
        : daysUntilWindowSample(habit, 'momentum', MIN_N.momentum.want, now),
    },
    {
      id: 'hitRate28',
      label: 'Hit rate',
      ready: hitRateReady,
      have: w28.scheduled,
      want: MIN_N.hitRate28.want,
      etaDays: hitRateReady
        ? 0
        : daysUntilWindowSample(habit, 'hitRate28', MIN_N.hitRate28.want, now),
    },
    {
      id: 'timeOfDay',
      label: 'Time of day',
      ready: timeOfDayReady,
      have: total,
      want: MIN_N.timeOfDay.want,
      etaDays: timeOfDayReady
        ? 0
        : daysUntilScheduledReps(habit, MIN_N.timeOfDay.want - total, now),
    },
    {
      id: 'weekdayPattern',
      label: 'Weekday pattern',
      ready: weekdayReady,
      have: age,
      want: MIN_N.weekdayPattern.want,
      etaDays: weekdayReady ? 0 : MIN_N.weekdayPattern.want - age,
    },
    {
      id: 'baseline28',
      label: '28-day comparison',
      ready: baselineReady,
      have: age,
      want: MIN_N.baseline28.want,
      etaDays: baselineReady ? 0 : MIN_N.baseline28.want - age,
    },
    {
      id: 'monthOverMonth',
      label: 'Monthly view',
      ready: monthOverMonthReady,
      have: monthsHave,
      want: MIN_N.monthOverMonth.want,
      etaDays: monthOverMonthReady
        ? 0
        : calendarDayDistance(startOfDay(now), addMonths(startOfMonth(now), MIN_N.monthOverMonth.want - monthsHave)),
    },
  ]

  return { ageDays: age, activeDays: active, totalReps: total, unlocks }
}

// ── Hit rate over a trailing window ─────────────────────────────────────────
// "Hit" = a scheduled day with at least one rep. Off-days never count against
// the rate, and today only counts once something is logged (the day isn't
// over yet — no guilt at 8am).

export function windowStats(habit, days, now = Date.now()) {
  const today = startOfDay(now)
  const from = Math.max(firstDay(habit, now), addDays(today, -(days - 1)))
  return windowStatsRange(habit, from, today)
}

export function windowStatsRange(habit, fromMs, toMs, opts = { pendingToday: true }) {
  const counts = dayCounts(habit)
  const from = Math.max(startOfDay(fromMs), firstDay(habit, toMs))
  const to = startOfDay(toMs)
  const pendingToday = opts?.pendingToday ?? true
  let scheduled = 0
  let hit = 0
  let reps = 0
  let activeDays = 0
  let spanDays = 0
  for (const d of eachDay(from, to)) {
    spanDays++
    const c = counts.get(d) || 0
    reps += c
    if (c > 0) activeDays++
    if (pendingToday && d === to && c === 0) continue
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

function startOfMonth(ms) {
  const d = new Date(ms)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addMonths(monthMs, n) {
  const d = new Date(monthMs)
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function calendarDayDistance(fromMs, toMs) {
  let days = 0
  for (const _day of eachDay(addDays(fromMs, 1), toMs)) days++
  return days
}

// Local calendar-month totals, oldest to newest. Portfolio buckets deliberately
// omit adherence math: scheduled-day rates only have a clear meaning per habit.
export function monthlySeries(habitOrHabits, months = 12, now = Date.now()) {
  const list = Array.isArray(habitOrHabits) ? habitOrHabits : [habitOrHabits]
  const portfolio = Array.isArray(habitOrHabits)
  const count = Math.max(0, Math.floor(months))
  if (count === 0) return []

  const today = startOfDay(now)
  const currentMonth = startOfMonth(today)
  const starts = list.map((habit) => firstDay(habit, now))
  const earliestStart = starts.length > 0 ? Math.min(...starts) : null

  return Array.from({ length: count }, (_, i) => {
    const start = addMonths(currentMonth, -(count - 1 - i))
    const next = addMonths(start, 1)
    const end = addDays(next, -1)
    const rangeEnd = Math.min(end, today)
    const existed = starts.some((first) => first <= rangeEnd)
    const startDate = new Date(start)
    const year = startDate.getFullYear()
    const month = startDate.getMonth()
    const base = {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      start,
      label: startDate.toLocaleDateString(undefined, { month: 'short' }),
      year,
      reps: 0,
      activeDays: 0,
      scheduled: portfolio ? null : 0,
      hit: portfolio ? null : 0,
      rate: null,
      isPartial: start === currentMonth,
      existed,
      daysIn: existed ? calendarDayDistance(Math.max(start, earliestStart), rangeEnd) + 1 : 0,
    }

    if (!existed) return base

    if (portfolio) {
      for (let h = 0; h < list.length; h++) {
        if (starts[h] > rangeEnd) continue
        const stats = windowStatsRange(list[h], start, rangeEnd, { pendingToday: start === currentMonth })
        base.reps += stats.reps
        base.activeDays += stats.activeDays
      }
      return base
    }

    const stats = windowStatsRange(list[0], start, rangeEnd, { pendingToday: start === currentMonth })
    return {
      ...base,
      reps: stats.reps,
      activeDays: stats.activeDays,
      scheduled: stats.scheduled,
      hit: stats.hit,
      rate: stats.rate,
      daysIn: stats.spanDays,
    }
  })
}

// Compare the trailing window with the equally sized window immediately before
// it. A 42-day minimum gives the prior window at least half a sample.
export function compareWindows(habit, days = 28, now = Date.now()) {
  const today = startOfDay(now)
  const current = windowStatsRange(habit, addDays(today, -(days - 1)), today)
  const prior = windowStatsRange(habit, addDays(today, -(days * 2 - 1)), addDays(today, -days), {
    pendingToday: false,
  })
  const repsDelta = current.reps - prior.reps
  const rateDelta = (current.rate ?? 0) - (prior.rate ?? 0)
  const rateIsFlat = Math.abs(rateDelta) < 0.05
  const direction = rateIsFlat && repsDelta === 0 ? 'flat' : rateDelta >= 0.05 || (rateIsFlat && repsDelta > 0) ? 'up' : 'down'

  return {
    current,
    prior,
    repsDelta,
    rateDelta,
    direction,
    enoughHistory: ageDays(habit, now) >= days * 1.5,
  }
}

// Best complete sliding window, with equal totals resolved toward the most
// recent window. Rate follows the same scheduled-day rules as windowStats().
export function bestWindow(habit, days = 28, now = Date.now()) {
  if (ageDays(habit, now) < days) return null

  const today = startOfDay(now)
  const firstEnd = addDays(firstDay(habit, now), days - 1)
  let best = null
  for (const end of eachDay(firstEnd, today)) {
    const start = addDays(end, -(days - 1))
    const stats = windowStatsRange(habit, start, end, { pendingToday: end === today })
    if (!best || stats.reps >= best.reps) best = { start, end, reps: stats.reps, rate: stats.rate }
  }
  return best
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
