import { GOAL, startOfDay, isScheduledOn, currentStreak, WEEKDAY_LABELS } from './habits.js'

// Pure analytics over a habit's completion history. Everything here is
// deterministic math on {t, amount} events — no store, no React — so the
// panel can memoize one analyzeHabit()/analyzePortfolio() call per render.

const DAY = 86400000

// ── Date helpers ────────────────────────────────────────────────────────────
// Day stepping goes through Date#setDate (not ms arithmetic) so DST shifts
// can't drift the cursor into the wrong day.

function addDays(dayMs, n) {
  const d = new Date(dayMs)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function* eachDay(fromMs, toMs) {
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

export function firstDay(habit, now = Date.now()) {
  let min = habit.createdAt || now
  for (const e of habit.history || []) if (e.t < min) min = e.t
  return startOfDay(min)
}

export function ageDays(habit, now = Date.now()) {
  return Math.max(1, Math.round((startOfDay(now) - firstDay(habit, now)) / DAY) + 1)
}

function totalReps(habit) {
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

// ── Conclusions engine ──────────────────────────────────────────────────────
// Turns the numbers above into short written conclusions. Every sentence must
// be backed by the habit's own data — no generic motivational fluff — and the
// tone stays on-brand: no guilt, misses pause the climb, they never reset it.
// tone: 'up' (win) | 'warn' (needs attention) | 'info' (neutral pattern) |
// 'star' (record/milestone).

function buildHabitInsights(habit, ctx, allHabits, now) {
  const { pace, wk, parts, fc, streak, longest, w28, rec } = ctx
  const out = []
  const add = (weight, insight) => out.push({ weight, ...insight })

  const scheduledLabel = habit.days && habit.days.length > 0 && habit.days.length < 7 ? 'scheduled day' : 'day'

  // Not enough signal yet → say so honestly instead of over-reading noise.
  if (pace.totalReps < 3 || pace.ageDays < 4) {
    add(100, {
      id: 'warming-up',
      tone: 'info',
      icon: '🌱',
      title: 'Still warming up',
      text:
        pace.totalReps === 0
          ? 'Nothing logged yet — hold to bank the first rep and the analysis starts reading your patterns.'
          : `Only ${pace.totalReps} rep${pace.totalReps === 1 ? '' : 's'} logged so far — the analysis sharpens after a few more days of history.`,
    })
  }

  // Summit reached.
  if (fc.done) {
    add(95, {
      id: 'summit',
      tone: 'star',
      icon: '⛰️',
      title: 'Summit reached',
      text: `You hit rep 60 on ${fmtDate(fc.summitAt)}${fc.bonus > 0 ? ` and kept going — ${fc.bonus} bonus rep${fc.bonus === 1 ? '' : 's'} since` : ''}. This habit has carried itself past mastery.`,
    })
  }

  // Forecast.
  if (!fc.done && !fc.stalled && pace.totalReps >= 3) {
    add(90, {
      id: 'forecast',
      tone: 'up',
      icon: '🔭',
      title: `Summit forecast: ~${fmtDate(fc.eta)}`,
      text: `At your blended pace of ${fc.perWeek.toFixed(1)} reps/week, the remaining ${fc.remaining} reps take about ${fc.daysLeft} days. Every rep you add today pulls that date closer.`,
    })
  }

  // Stalled / paused climb.
  if (!fc.done && rec.sinceLast !== null && rec.sinceLast >= 5) {
    add(92, {
      id: 'paused',
      tone: 'warn',
      icon: '⏸️',
      title: `Paused for ${rec.sinceLast} days`,
      text: `Nothing logged since ${fmtDate(habit.lastCompletedAt)}. The climb is paused, not lost — your ${habit.reps} reps are still banked, and one hold restarts the streak math.`,
    })
  }

  // Momentum swing (needs a real base to compare against).
  if (pace.prev7 >= 2 && Math.abs(pace.momentum) >= 0.25) {
    const upSwing = pace.momentum > 0
    add(80, {
      id: 'momentum',
      tone: upSwing ? 'up' : 'warn',
      icon: upSwing ? '📈' : '📉',
      title: upSwing
        ? `Momentum +${Math.round(pace.momentum * 100)}%`
        : `Momentum ${Math.round(pace.momentum * 100)}%`,
      text: upSwing
        ? `${pace.last7} reps this week vs ${pace.prev7} last week — the pace is accelerating.`
        : `${pace.last7} rep${pace.last7 === 1 ? '' : 's'} this week vs ${pace.prev7} last week. A lighter week only slows the climb; nothing was lost.`,
    })
  }

  // Best streak ever, happening right now.
  if (streak >= 3 && streak >= longest) {
    add(85, {
      id: 'best-streak',
      tone: 'star',
      icon: '🔥',
      title: 'Longest streak ever — live',
      text: `${streak} days and counting. Your previous best run just became your floor.`,
    })
  }

  // Weekday pattern: a strong day and a weak day, both with enough samples.
  if (wk.best && wk.worst && wk.best.wd !== wk.worst.wd && wk.best.rate - wk.worst.rate >= 0.35) {
    add(70, {
      id: 'weekday-pattern',
      tone: 'info',
      icon: '📅',
      title: `${wk.best.label}s carry this habit`,
      text: `Over the last 12 weeks you hit ${pctLabel(wk.best.rate)} of ${wk.best.label}s but only ${pctLabel(wk.worst.rate)} of ${wk.worst.label}s. If ${wk.worst.label}s keep slipping, try anchoring this habit to something you already do that day.`,
    })
  }

  // Weekend vs weekday split.
  if (
    wk.weekendRate !== null &&
    wk.weekdayRate !== null &&
    Math.abs(wk.weekdayRate - wk.weekendRate) >= 0.3 &&
    (!wk.best || !wk.worst || wk.best.rate - wk.worst.rate < 0.35) // don't double-report
  ) {
    const weekdaysStronger = wk.weekdayRate > wk.weekendRate
    add(65, {
      id: 'weekend-split',
      tone: 'info',
      icon: weekdaysStronger ? '🗓️' : '🛋️',
      title: weekdaysStronger ? 'Weekends are the slip zone' : 'Weekends do the heavy lifting',
      text: weekdaysStronger
        ? `${pctLabel(wk.weekdayRate)} hit rate Mon–Fri vs ${pctLabel(wk.weekendRate)} on weekends. Structure seems to help this habit — weekends may need a fixed slot.`
        : `${pctLabel(wk.weekendRate)} hit rate on weekends vs ${pctLabel(wk.weekdayRate)} Mon–Fri. Free time is when this habit thrives.`,
    })
  }

  // Time-of-day signature.
  if (parts.total >= 8 && parts.top && parts.top.share >= 0.55) {
    const partName = parts.top.label.toLowerCase()
    add(60, {
      id: 'time-of-day',
      tone: 'info',
      icon: parts.top.emoji,
      title: `${/^[aeiou]/.test(partName) ? 'An' : 'A'} ${partName} habit`,
      text: `${pctLabel(parts.top.share)} of all reps land in the ${parts.top.label.toLowerCase()} (${parts.top.hint}). That window is where this habit actually happens — protect it.`,
    })
  }

  // Milestone: past halfway.
  if (!fc.done && habit.reps >= GOAL / 2) {
    add(55, {
      id: 'halfway',
      tone: 'star',
      icon: '🏕️',
      title: 'Past the halfway camp',
      text: `${habit.reps} of 60 reps banked — the summit is closer than the trailhead. ${fc.stalled ? 'It only takes one rep to get the forecast running again.' : ''}`,
    })
  }

  // Record day (only meaningful when multiple reps per day are possible).
  if (habit.type !== 'single' && rec.bestDay && rec.bestDay.reps >= 3) {
    add(50, {
      id: 'record-day',
      tone: 'star',
      icon: '🏆',
      title: `Record day: ${rec.bestDay.reps} reps`,
      text: `Your biggest single day was ${fmtDate(rec.bestDay.date)} with ${rec.bestDay.reps} reps — proof this habit can absorb a big session when you have the time.`,
    })
  }

  // 28-day reliability read.
  if (w28.scheduled >= 10 && w28.rate !== null) {
    if (w28.rate >= 0.8) {
      add(45, {
        id: 'reliable',
        tone: 'up',
        icon: '🧱',
        title: `${pctLabel(w28.rate)} reliable this month`,
        text: `You showed up on ${w28.hit} of the last ${w28.scheduled} ${scheduledLabel}s. At this hit rate the habit is effectively on autopilot.`,
      })
    } else if (w28.rate < 0.4 && !fc.done) {
      add(75, {
        id: 'loose-grip',
        tone: 'warn',
        icon: '🪢',
        title: 'The routine hasn\'t gripped yet',
        text: `${w28.hit} of ${w28.scheduled} ${scheduledLabel}s hit in the last 4 weeks (${pctLabel(w28.rate)}). Shrinking the rep until it's almost too easy usually beats trying harder.`,
      })
    }
  }

  // Bonus reps on rest days (scheduled habits only).
  if (habit.days && habit.days.length > 0 && habit.days.length < 7) {
    let offDayReps = 0
    for (const e of habit.history || []) if (!isScheduledOn(habit, e.t)) offDayReps += e.amount
    if (offDayReps >= 3) {
      add(40, {
        id: 'bonus-reps',
        tone: 'up',
        icon: '💪',
        title: `${offDayReps} bonus reps on rest days`,
        text: `You've logged ${offDayReps} reps on days this habit isn't even scheduled. The schedule is a floor, not a ceiling — and you're treating it that way.`,
      })
    }
  }

  // Cross-habit comparison: is this the steadiest habit in the portfolio?
  const peers = allHabits.filter((h) => h.id !== habit.id && ageDays(h, now) >= 7)
  if (peers.length >= 1 && pace.ageDays >= 7 && !out.some((i) => i.id === 'warming-up')) {
    const myScore = consistencyScore(habit, now).score
    const peerScores = peers.map((h) => ({ h, s: consistencyScore(h, now).score }))
    const topPeer = peerScores.reduce((a, b) => (b.s > a.s ? b : a))
    if (myScore >= topPeer.s + 10 && myScore >= 50) {
      add(35, {
        id: 'steadiest',
        tone: 'star',
        icon: '🥇',
        title: 'Your steadiest habit',
        text: `Consistency score ${myScore} — the highest across your ${allHabits.length} habits. Whatever cue keeps this one alive is worth copying to the others.`,
      })
    }
  }

  out.sort((a, b) => b.weight - a.weight)
  return out.slice(0, 6)
}

// One call → everything the per-habit analytics view needs.
export function analyzeHabit(habit, allHabits = [], now = Date.now()) {
  const pace = paceStats(habit, now)
  const wk = weekdayProfile(habit, now)
  const parts = dayParts(habit)
  const fc = forecast(habit, now)
  const streak = currentStreak(habit, now)
  const longest = longestStreak(habit, now)
  const w28 = windowStats(habit, 28, now)
  const rec = records(habit, now)
  const score = consistencyScore(habit, now)
  const weekly = weeklySeries(habit, 8, now)
  const insights = buildHabitInsights(habit, { pace, wk, parts, fc, streak, longest, w28, rec }, allHabits, now)
  return { pace, wk, parts, fc, streak, longest, w28, rec, score, weekly, insights }
}

// ── Portfolio (all habits) ──────────────────────────────────────────────────

export function analyzePortfolio(habits, now = Date.now()) {
  const totalRepsAll = habits.reduce((s, h) => s + totalReps(h), 0)
  const summits = habits.filter((h) => h.reps >= GOAL).length
  const perHabit = habits.map((h) => ({
    habit: h,
    streak: currentStreak(h, now),
    score: consistencyScore(h, now),
    pace: paceStats(h, now),
    fc: forecast(h, now),
    rec: records(h, now),
  }))
  const activeStreaks = perHabit.filter((p) => p.streak >= 2).length
  const thisWeek = perHabit.reduce((s, p) => s + p.pace.last7, 0)
  const lastWeek = perHabit.reduce((s, p) => s + p.pace.prev7, 0)
  const weekly = weeklySeries(habits, 8, now)

  const insights = []
  const add = (weight, insight) => insights.push({ weight, ...insight })

  // Weekly output swing across everything.
  if (lastWeek >= 3 && Math.abs(thisWeek - lastWeek) / lastWeek >= 0.2) {
    const up = thisWeek > lastWeek
    add(90, {
      id: 'portfolio-momentum',
      tone: up ? 'up' : 'warn',
      icon: up ? '🚀' : '🌫️',
      title: up ? 'Output is climbing' : 'A quieter week',
      text: `${thisWeek} reps across all habits this week vs ${lastWeek} last week (${up ? '+' : ''}${Math.round(((thisWeek - lastWeek) / lastWeek) * 100)}%).${up ? '' : ' Quiet weeks pause the climb — they never undo it.'}`,
    })
  }

  // Steadiest habit.
  const seasoned = perHabit.filter((p) => ageDays(p.habit, now) >= 7)
  if (seasoned.length >= 2) {
    const top = seasoned.reduce((a, b) => (b.score.score > a.score.score ? b : a))
    if (top.score.score >= 50) {
      add(80, {
        id: 'anchor-habit',
        tone: 'star',
        icon: '⚓',
        title: `${top.habit.emoji || ''} ${top.habit.title} is your anchor`,
        text: `Consistency score ${top.score.score} (${top.score.label.toLowerCase()}) — the steadiest thing on your board. Stack fragile habits right after this one; it's your most reliable cue.`,
      })
    }
  }

  // Habit most at risk (ignore mastered ones — they earned the rest).
  const atRisk = perHabit
    .filter((p) => p.habit.reps < GOAL && p.rec.sinceLast !== null && p.rec.sinceLast >= 5)
    .sort((a, b) => b.rec.sinceLast - a.rec.sinceLast)[0]
  if (atRisk) {
    add(85, {
      id: 'at-risk',
      tone: 'warn',
      icon: '🧗',
      title: `${atRisk.habit.emoji || ''} ${atRisk.habit.title} is drifting`,
      text: `${atRisk.rec.sinceLast} days since its last rep — the longest silence on your board. Its ${atRisk.habit.reps} reps are still banked; one 2-minute version tonight restarts it.`,
    })
  }

  // Nearest summit.
  const climbing = perHabit.filter((p) => !p.fc.done && !p.fc.stalled)
  if (climbing.length > 0) {
    const nearest = climbing.reduce((a, b) => (b.fc.daysLeft < a.fc.daysLeft ? b : a))
    add(75, {
      id: 'next-summit',
      tone: 'up',
      icon: '🎯',
      title: `Next summit: ${nearest.habit.emoji || ''} ${nearest.habit.title}`,
      text: `Only ${nearest.fc.remaining} reps to go — on pace to hit 60 around ${fmtDate(nearest.fc.eta)}. The first mastered habit tends to make the second one feel inevitable.`,
    })
  }

  // Overall best day of the week (aggregate reps by weekday, last 12 weeks).
  const wdReps = new Array(7).fill(0)
  const today = startOfDay(now)
  const from = addDays(today, -83)
  for (const h of habits) {
    for (const e of h.history || []) {
      const d = startOfDay(e.t)
      if (d >= from) wdReps[new Date(d).getDay()] += e.amount
    }
  }
  const totalWd = wdReps.reduce((a, b) => a + b, 0)
  if (totalWd >= 15) {
    const bestWd = wdReps.indexOf(Math.max(...wdReps))
    if (wdReps[bestWd] / totalWd >= 0.2) {
      add(60, {
        id: 'power-day',
        tone: 'info',
        icon: '⚡',
        title: `${WEEKDAY_LABELS[bestWd]} is your power day`,
        text: `${wdReps[bestWd]} of your last ${totalWd} reps (${pctLabel(wdReps[bestWd] / totalWd)}) landed on ${WEEKDAY_LABELS[bestWd]}s. Schedule the hard stuff there — that's when you show up.`,
      })
    }
  }

  insights.sort((a, b) => b.weight - a.weight)

  return {
    totalReps: totalRepsAll,
    summits,
    activeStreaks,
    thisWeek,
    lastWeek,
    weekly,
    perHabit,
    insights: insights.slice(0, 5),
  }
}
