import { GOAL, currentStreak } from './habits.js'
import {
  ageDays,
  bestWindow,
  compareWindows,
  consistencyScore,
  dayParts,
  forecast,
  longestStreak,
  monthlySeries,
  paceStats,
  records,
  totalReps,
  weekdayProfile,
  weeklySeries,
  windowStats,
} from './analytics/metrics.js'
import { buildHabitInsights, buildPortfolioInsights } from './analytics/insights.js'

export * from './analytics/metrics.js'
export * from './analytics/insights.js'

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
  const months = monthlySeries(habit, 12, now)
  const compare28 = compareWindows(habit, 28, now)
  const best28 = bestWindow(habit, 28, now)
  const longHeatmapWeeks = pace.ageDays >= 120 ? 53 : null
  const insights = buildHabitInsights(
    habit,
    { pace, wk, parts, fc, streak, longest, w28, rec, compare28, best28, months },
    allHabits,
    now,
  )
  return {
    pace,
    wk,
    parts,
    fc,
    streak,
    longest,
    w28,
    rec,
    score,
    weekly,
    months,
    compare28,
    best28,
    longHeatmapWeeks,
    insights,
  }
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
  const months = monthlySeries(habits, 12, now)
  const insights = buildPortfolioInsights(habits, perHabit, thisWeek, lastWeek, now)

  return {
    totalReps: totalRepsAll,
    summits,
    activeStreaks,
    thisWeek,
    lastWeek,
    weekly,
    months,
    perHabit,
    insights: insights.slice(0, 5),
  }
}
