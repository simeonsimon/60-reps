import { GOAL, currentStreak, startOfDay, isScheduledOn, WEEKDAY_LABELS } from '../habits.js'
import { MIN_N, addDays, ageDays, consistencyScore, dayCounts, fmtDate, pctLabel, readiness } from './metrics.js'

// ── Conclusions engine ──────────────────────────────────────────────────────
// Turns the numbers above into short written conclusions. Every sentence must
// be backed by the habit's own data — no generic motivational fluff — and the
// tone stays on-brand: no guilt, misses pause the climb, they never reset it.
// tone: 'up' (win) | 'warn' (needs attention) | 'info' (neutral pattern) |
// 'star' (record/milestone).

const DAY = 86400000

function cheapWindowComparison(habit, counts, first, today) {
  const current = { scheduled: 0, hit: 0, reps: 0, rate: null }
  const prior = { scheduled: 0, hit: 0, reps: 0, rate: null }

  // Deliberately derive both windows from the headline's one dayCounts() map.
  // compareWindows() rebuilds that map for each range, which is right for the
  // full analytics view but unnecessary work for every home-screen row.
  for (let offset = -55; offset <= 0; offset++) {
    const day = addDays(today, offset)
    if (day < first) continue
    const bucket = offset >= -27 ? current : prior
    const reps = counts.get(day) || 0
    bucket.reps += reps
    if (offset === 0 && reps === 0) continue
    if (isScheduledOn(habit, day)) {
      bucket.scheduled++
      if (reps > 0) bucket.hit++
    }
  }

  current.rate = current.scheduled > 0 ? current.hit / current.scheduled : null
  prior.rate = prior.scheduled > 0 ? prior.hit / prior.scheduled : null
  const repsDelta = current.reps - prior.reps
  const rateDelta = (current.rate ?? 0) - (prior.rate ?? 0)
  const rateIsFlat = Math.abs(rateDelta) < 0.05
  const direction = rateIsFlat && repsDelta === 0
    ? 'flat'
    : rateDelta >= 0.05 || (rateIsFlat && repsDelta > 0)
      ? 'up'
      : 'down'
  return { current, prior, direction }
}

// Cheap home-screen meaning: one history aggregation plus currentStreak().
// This intentionally does not call analyzeHabit() or the full comparison APIs.
export function habitHeadline(habit, now = Date.now()) {
  const today = startOfDay(now)
  const counts = dayCounts(habit)
  const todayReps = counts.get(today) || 0

  if (isScheduledOn(habit, today) && todayReps === 0) {
    return { tone: 'info', icon: '○', text: 'Today is scheduled — bank one rep when you are ready.' }
  }

  const streak = currentStreak(habit, now)
  if (streak >= 2) {
    return { tone: 'up', icon: '🔥', text: `${streak}-day streak alive — protect it at the next scheduled rep.` }
  }

  let first = startOfDay(habit.createdAt || now)
  let latest = null
  let loggedReps = 0
  for (const [day, reps] of counts) {
    if (day < first) first = day
    if (day <= today && (latest === null || day > latest)) latest = day
    loggedReps += reps
  }

  const pausedDays = latest === null ? null : Math.round((today - latest) / DAY)
  if (pausedDays !== null && pausedDays >= 3) {
    return {
      tone: 'warn',
      icon: '⏸️',
      text: `${pausedDays} days paused — your ${loggedReps} reps are still banked.`,
    }
  }

  const age = Math.max(1, Math.round((today - first) / DAY) + 1)
  if (age >= MIN_N.baseline28.want) {
    const comparison = cheapWindowComparison(habit, counts, first, today)
    const directionLabel = comparison.direction === 'up' ? 'up' : comparison.direction === 'down' ? 'down' : 'level'
    return {
      tone: comparison.direction === 'up' ? 'up' : comparison.direction === 'down' ? 'warn' : 'info',
      icon: comparison.direction === 'up' ? '↗' : comparison.direction === 'down' ? '↘' : '→',
      text: `Last 4 weeks: ${comparison.current.reps} reps vs ${comparison.prior.reps} before — pace is ${directionLabel}.`,
    }
  }

  const reps = habit.reps ?? loggedReps
  if (reps > 0) {
    const remaining = Math.max(0, GOAL - reps)
    return remaining === 0
      ? { tone: 'star', icon: '⛰️', text: '60 reps banked — summit reached.' }
      : { tone: 'info', icon: '⛰️', text: `${remaining} reps remain to reach the 60-rep summit.` }
  }

  return { tone: 'info', icon: '🌱', text: 'No reps yet — start this climb with one small hold.' }
}

export function buildHabitInsights(habit, ctx, allHabits, now) {
  const { pace, wk, parts, fc, streak, longest, w28, rec, compare28, best28, months } = ctx
  const out = []
  const add = (weight, insight) => out.push({ weight, ...insight })

  const scheduledLabel = habit.days && habit.days.length > 0 && habit.days.length < 7 ? 'scheduled day' : 'day'

  // Not enough signal yet → name the first trustworthy pattern and its horizon.
  if (pace.totalReps < MIN_N.forecast.want || pace.ageDays < MIN_N.forecast.alsoDays) {
    const state = readiness(habit, now)
    const weekdayGate = state.unlocks.find((unlock) => unlock.id === 'weekdayPattern')
    const dayLabel = pace.ageDays === 1 ? 'day' : 'days'
    const etaLabel = weekdayGate.etaDays === 1 ? 'day' : 'days'
    add(100, {
      id: 'warming-up',
      tone: 'info',
      icon: '🌱',
      title: 'Building a baseline',
      text: `${pace.ageDays} ${dayLabel} of history. Your weekday pattern reads at ${MIN_N.weekdayPattern.want} days — about ${weekdayGate.etaDays} ${etaLabel} away.`,
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
  if (
    !fc.done &&
    !fc.stalled &&
    pace.totalReps >= MIN_N.forecast.want &&
    pace.ageDays >= MIN_N.forecast.alsoDays
  ) {
    add(90, {
      id: 'forecast',
      tone: 'up',
      icon: '🔭',
      title: `Summit forecast: ~${fmtDate(fc.eta)}`,
      text: `At your blended pace of ${fc.perWeek.toFixed(1)} reps/week, the remaining ${fc.remaining} reps take about ${fc.daysLeft} days. Every rep you add today pulls that date closer.`,
    })
  }

  // Four-week baseline against the immediately preceding four weeks.
  if (compare28.enoughHistory && compare28.direction !== 'flat') {
    const better = compare28.direction === 'up'
    add(88, {
      id: better ? 'baseline-better' : 'baseline-worse',
      tone: better ? 'up' : 'warn',
      icon: better ? '↗️' : '↘️',
      title: better ? 'Better than a month ago' : 'Quieter than a month ago',
      text: `Last 4 weeks: ${compare28.current.reps} reps across ${pctLabel(compare28.current.rate ?? 0)} of scheduled days. The 4 weeks before: ${compare28.prior.reps} at ${pctLabel(compare28.prior.rate ?? 0)}. You are measurably ${better ? 'better' : 'quieter'} than a month ago.`,
      action: better
        ? undefined
        : best28
          ? `Compare today with your ${best28.reps}-rep stretch from ${fmtDate(best28.start)} – ${fmtDate(best28.end)} and restore one condition.`
          : `Match the prior window's ${compare28.prior.reps} reps over the next 4 weeks.`,
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
      action: `Bank one rep today to end this ${rec.sinceLast}-day pause.`,
    })
  }

  // Momentum swing (needs a real base to compare against).
  if (pace.prev7 >= MIN_N.momentum.want && Math.abs(pace.momentum) >= 0.25) {
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
      action: upSwing
        ? undefined
        : `Log ${pace.prev7 - pace.last7} more rep${pace.prev7 - pace.last7 === 1 ? '' : 's'} to match last week's total.`,
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
  if (
    pace.ageDays >= MIN_N.weekdayPattern.want &&
    wk.best &&
    wk.worst &&
    wk.best.wd !== wk.worst.wd &&
    wk.best.rate - wk.worst.rate >= 0.35
  ) {
    add(70, {
      id: 'weekday-pattern',
      tone: 'info',
      icon: '📅',
      title: `${wk.best.label}s carry this habit`,
      text: `Over the last 12 weeks you hit ${pctLabel(wk.best.rate)} of ${wk.best.label}s but only ${pctLabel(wk.worst.rate)} of ${wk.worst.label}s.`,
      action: `Target the ${pctLabel(wk.best.rate - wk.worst.rate)} gap by anchoring this habit to an existing ${wk.worst.label} routine.`,
    })
  }

  // Strongest complete rolling window, once the 28-day baseline gate is open.
  if (best28 && pace.ageDays >= MIN_N.baseline28.want && best28.reps > 0) {
    add(72, {
      id: 'best-window',
      tone: 'star',
      icon: '🏔️',
      title: `Best 28-day stretch: ${best28.reps} reps`,
      text: `${fmtDate(best28.start)} – ${fmtDate(best28.end)} carried ${best28.reps} reps${best28.rate === null ? '' : ` at a ${pctLabel(best28.rate)} scheduled-day hit rate`}.`,
    })
  }

  // Weekend vs weekday split.
  if (
    pace.ageDays >= MIN_N.weekdayPattern.want &&
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
        ? `${pctLabel(wk.weekdayRate)} hit rate Mon–Fri vs ${pctLabel(wk.weekendRate)} on weekends. Structure is where this habit lands most often.`
        : `${pctLabel(wk.weekendRate)} hit rate on weekends vs ${pctLabel(wk.weekdayRate)} Mon–Fri. Free time is when this habit thrives.`,
      action: weekdaysStronger
        ? `Close the ${pctLabel(wk.weekdayRate - wk.weekendRate)} gap by giving weekends one fixed slot.`
        : `Protect the ${pctLabel(wk.weekendRate - wk.weekdayRate)} weekend edge by keeping one weekend slot open.`,
    })
  }

  // Month-over-month only compares two full calendar months.
  const completeMonths = months.filter((month) => {
    const monthNumber = Number(month.key.slice(5, 7))
    const calendarDays = new Date(month.year, monthNumber, 0).getDate()
    return month.existed && !month.isPartial && month.daysIn === calendarDays
  })
  if (completeMonths.length >= MIN_N.monthOverMonth.want) {
    const newer = completeMonths.at(-1)
    const older = completeMonths.at(-2)
    if (newer.reps !== older.reps) {
      const up = newer.reps > older.reps
      const gap = Math.abs(newer.reps - older.reps)
      add(68, {
        id: 'month-over-month',
        tone: up ? 'up' : 'warn',
        icon: up ? '📅' : '🗓️',
        title: `${newer.label} ${up ? 'built on' : 'trailed'} ${older.label}`,
        text: `${newer.label}: ${newer.reps} reps at ${pctLabel(newer.rate ?? 0)} of scheduled days. ${older.label}: ${older.reps} at ${pctLabel(older.rate ?? 0)}.`,
        action: up ? undefined : `Close the ${gap}-rep gap this month.`,
      })
    }
  }

  // Time-of-day signature.
  if (parts.total >= MIN_N.timeOfDay.want && parts.top && parts.top.share >= 0.55) {
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
  if (w28.scheduled >= MIN_N.hitRate28.want && w28.rate !== null) {
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
        text: `${w28.hit} of ${w28.scheduled} ${scheduledLabel}s hit in the last 4 weeks (${pctLabel(w28.rate)}).`,
        action: `Shrink the next rep and rebuild from this ${pctLabel(w28.rate)} hit rate.`,
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

export function buildPortfolioInsights(habits, perHabit, thisWeek, lastWeek, now) {
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
      action: up ? undefined : `Bank ${lastWeek - thisWeek} more rep${lastWeek - thisWeek === 1 ? '' : 's'} to match last week's total.`,
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
      text: `${atRisk.rec.sinceLast} days since its last rep — the longest silence on your board. Its ${atRisk.habit.reps} reps are still banked.`,
      action: `Bank one rep today to end this ${atRisk.rec.sinceLast}-day silence.`,
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
  return insights.slice(0, 5)
}
