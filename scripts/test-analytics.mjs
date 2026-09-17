process.env.TZ = 'Europe/Madrid'

const analytics = await import('../src/lib/analytics.js')

const {
  MIN_N,
  analyzeHabit,
  bestWindow,
  compareWindows,
  dayCompletion,
  forecast,
  habitHeadline,
  longestStreak,
  masteryDate,
  monthlySeries,
  paceStats,
  readiness,
  consistencyScore,
  weeklySeries,
  windowStats,
} = analytics

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ', name) }
  else { fail++; console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra) : '') }
}

function habit(over = {}) {
  const h = {
    id: 'h',
    title: 'Test habit',
    type: 'single',
    days: [],
    createdAt: new Date(2026, 0, 1, 12).getTime(),
    history: [],
    lastCompletedAt: null,
    ...over,
  }
  if (!Object.hasOwn(over, 'reps')) h.reps = h.history.reduce((sum, event) => sum + event.amount, 0)
  if (!Object.hasOwn(over, 'lastCompletedAt') && h.history.length > 0) {
    h.lastCompletedAt = Math.max(...h.history.map((event) => event.t))
  }
  return h
}

function dayAtOffset(now, offset, hour = 8) {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

console.log('\nanalytics export surface')
{
  const originalExports = [
    'DAY_PARTS',
    'ageDays',
    'analyzeHabit',
    'analyzePortfolio',
    'consistencyScore',
    'dayCompletion',
    'dayCounts',
    'dayParts',
    'firstDay',
    'fmtDate',
    'forecast',
    'longestStreak',
    'masteryDate',
    'paceStats',
    'pctLabel',
    'records',
    'weekdayProfile',
    'weeklySeries',
    'windowStats',
  ]
  const missing = originalExports.filter((name) => !(name in analytics))
  check('all pre-split exports are present', missing.length === 0, missing)
  check('readiness API is exported', typeof readiness === 'function' && MIN_N.weekdayPattern.want === 21)
  check(
    'long-view APIs are exported',
    typeof monthlySeries === 'function' &&
      typeof compareWindows === 'function' &&
      typeof bestWindow === 'function' &&
      typeof analytics.windowStatsRange === 'function',
  )
  check('meaning-layer headline API is exported', typeof habitHeadline === 'function')
}

console.log('\nwindowStats')
{
  const now = new Date(2026, 8, 16, 12).getTime() // Wednesday
  const h = habit({
    days: [1, 3, 5],
    createdAt: new Date(2026, 8, 13, 12).getTime(),
    history: [{ t: new Date(2026, 8, 14, 18).getTime(), amount: 1 }],
  })
  const stats = windowStats(h, 28, now)
  check('off-days are excluded from scheduled', stats.scheduled === 1, stats)
  check('today with zero reps is not a miss', stats.hit === 1 && stats.rate === 1, stats)
  check('window start clamps to firstDay', stats.spanDays === 4, stats)
}

console.log('\nlongestStreak')
{
  const activeOffDay = habit({
    days: [1],
    createdAt: new Date(2026, 8, 14, 12).getTime(),
    history: [
      { t: new Date(2026, 8, 14, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 15, 8).getTime(), amount: 1 },
    ],
  })
  check(
    'an active off-day extends a run',
    longestStreak(activeOffDay, new Date(2026, 8, 15, 12).getTime()) === 2,
  )

  const emptyOffDay = habit({
    days: [1, 3],
    createdAt: new Date(2026, 8, 14, 12).getTime(),
    history: [
      { t: new Date(2026, 8, 14, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 16, 8).getTime(), amount: 1 },
    ],
  })
  check(
    'an empty off-day is neutral',
    longestStreak(emptyOffDay, new Date(2026, 8, 16, 12).getTime()) === 2,
  )

  const pendingToday = habit({
    createdAt: new Date(2026, 8, 15, 12).getTime(),
    history: [{ t: new Date(2026, 8, 15, 8).getTime(), amount: 1 }],
  })
  check(
    'today pending is neutral',
    longestStreak(pendingToday, new Date(2026, 8, 16, 12).getTime()) === 1,
  )
}

console.log('\nDST calendar ranges')
{
  const spring = habit({ createdAt: new Date(2026, 2, 26, 12).getTime() })
  const springStats = windowStats(spring, 365, new Date(2026, 3, 1, 12).getTime())
  check('spring-forward range has the exact calendar-day count', springStats.spanDays === 7, springStats)

  const fall = habit({ createdAt: new Date(2026, 9, 22, 12).getTime() })
  const fallStats = windowStats(fall, 365, new Date(2026, 9, 28, 12).getTime())
  check('fall-back range has the exact calendar-day count', fallStats.spanDays === 7, fallStats)
}

console.log('\nforecast')
{
  const now = new Date(2026, 8, 16, 12).getTime()
  const blended = habit({
    createdAt: new Date(2026, 7, 1, 12).getTime(),
    history: [
      { t: new Date(2026, 7, 1, 8).getTime(), amount: 5 },
      { t: new Date(2026, 8, 10, 8).getTime(), amount: 5 },
    ],
  })
  const pace = paceStats(blended, now)
  const fc = forecast(blended, now)
  const daily28 = pace.last28 / Math.min(28, Math.max(1, pace.ageDays))
  const dailyLife = pace.totalReps / pace.ageDays
  const expectedRate = 0.7 * daily28 + 0.3 * dailyLife
  check(
    'effective rate is the 70/30 recent/lifetime blend to 6 decimals',
    (fc.perWeek / 7).toFixed(6) === expectedRate.toFixed(6),
    { actual: fc.perWeek / 7, expected: expectedRate },
  )

  const slow = habit({
    createdAt: new Date(2026, 0, 1, 12).getTime(),
    history: [{ t: new Date(2026, 0, 1, 8).getTime(), amount: 1 }],
  })
  const slowPace = paceStats(slow, now)
  const slowRate = slowPace.totalReps / slowPace.ageDays
  const projectedDays = Math.ceil((60 - slow.reps) / slowRate)
  const slowForecast = forecast(slow, now)
  check(
    'forecast is stalled when projected days exceed 730',
    projectedDays > 730 && slowForecast.stalled === true,
    { projectedDays, slowForecast },
  )

  const done = habit({
    reps: 65,
    history: [
      { t: new Date(2026, 0, 1, 8).getTime(), amount: 20 },
      { t: new Date(2026, 0, 2, 8).getTime(), amount: 20 },
      { t: new Date(2026, 0, 3, 8).getTime(), amount: 20 },
      { t: new Date(2026, 0, 4, 8).getTime(), amount: 5 },
    ],
  })
  const doneForecast = forecast(done, now)
  check(
    'done forecast returns masteryDate',
    doneForecast.done === true && doneForecast.summitAt === masteryDate(done),
    doneForecast,
  )
}

console.log('\nconsistencyScore')
{
  const now = new Date(2026, 8, 16, 12).getTime()
  const accelerating = habit({
    createdAt: new Date(2026, 8, 3, 12).getTime(),
    history: [
      { t: new Date(2026, 8, 8, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 9, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 10, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 11, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 12, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 13, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 14, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 15, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 16, 8).getTime(), amount: 1 },
    ],
  })
  const acceleratingPace = paceStats(accelerating, now)
  const acceleratingScore = consistencyScore(accelerating, now)
  check('fixture momentum exceeds +1 before clamping', acceleratingPace.momentum === 2.5, acceleratingPace)
  check('hand-computed score clamps positive momentum at +1', acceleratingScore.score === 76, acceleratingScore)

  const stopped = habit({
    createdAt: new Date(2026, 8, 3, 12).getTime(),
    history: [
      { t: new Date(2026, 8, 3, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 4, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 5, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 6, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 7, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 8, 8).getTime(), amount: 1 },
      { t: new Date(2026, 8, 9, 8).getTime(), amount: 1 },
    ],
  })
  const stoppedPace = paceStats(stopped, now)
  const stoppedScore = consistencyScore(stopped, now)
  check('fixture momentum reaches the -1 lower bound', stoppedPace.momentum === -1, stoppedPace)
  check('hand-computed score uses a zero trend factor at -1', stoppedScore.score === 32, stoppedScore)
}

console.log('\nweeklySeries')
{
  const h = habit({
    history: [
      { t: new Date(2026, 8, 13, 23, 59).getTime(), amount: 2 }, // Sunday
      { t: new Date(2026, 8, 14, 0, 0).getTime(), amount: 3 }, // Monday
    ],
  })
  const series = weeklySeries(h, 2, new Date(2026, 8, 16, 12).getTime())
  check('Sunday 23:59 stays in the closing week', series[0].reps === 2, series)
  check('Monday 00:00 lands in the next week', series[1].reps === 3, series)
}

console.log('\nmonthlySeries')
{
  const now = new Date(2026, 8, 16, 12).getTime()
  const young = habit({
    createdAt: new Date(2026, 8, 13, 12).getTime(),
    history: [{ t: new Date(2026, 8, 14, 8).getTime(), amount: 1 }],
  })
  const youngSeries = monthlySeries(young, 12, now)
  check(
    'a four-day-old habit has one partial bucket and eleven pre-existence buckets',
    youngSeries.length === 12 &&
      youngSeries.filter((month) => month.existed).length === 1 &&
      youngSeries.filter((month) => !month.existed).length === 11 &&
      youngSeries.at(-1).isPartial &&
      youngSeries.at(-1).daysIn === 4,
    youngSeries,
  )

  const acrossNewYear = habit({
    createdAt: new Date(2026, 11, 30, 12).getTime(),
    history: [
      { t: new Date(2026, 11, 31, 8).getTime(), amount: 2 },
      { t: new Date(2027, 0, 2, 8).getTime(), amount: 1 },
    ],
  })
  const yearSeries = monthlySeries(acrossNewYear, 3, new Date(2027, 0, 10, 12).getTime())
  check(
    'calendar-year boundaries keep events in their local month',
    yearSeries.map((month) => month.key).join() === '2026-11,2026-12,2027-01' &&
      yearSeries.map((month) => month.reps).join() === '0,2,1' &&
      !yearSeries[0].existed &&
      yearSeries[1].existed &&
      yearSeries[2].existed,
    yearSeries,
  )

  const dstHabit = habit({
    createdAt: new Date(2026, 2, 1, 12).getTime(),
    history: [{ t: new Date(2026, 2, 29, 8).getTime(), amount: 1 }],
  })
  const dstSeries = monthlySeries(dstHabit, 2, new Date(2026, 3, 5, 12).getTime())
  check(
    'a month containing the spring DST transition has exactly 31 calendar days',
    dstSeries[0].key === '2026-03' && dstSeries[0].daysIn === 31 && dstSeries[0].scheduled === 31,
    dstSeries[0],
  )

  const portfolioSeries = monthlySeries([young, acrossNewYear], 1, new Date(2027, 0, 10, 12).getTime())
  check(
    'portfolio months aggregate activity without inventing an adherence rate',
    portfolioSeries[0].reps === 1 && portfolioSeries[0].activeDays === 1 && portfolioSeries[0].rate === null,
    portfolioSeries[0],
  )
}

console.log('\nlong-view comparisons')
{
  const now = new Date(2026, 8, 16, 12).getTime()
  const realShape = habit({
    title: 'Four-day habit',
    createdAt: dayAtOffset(now, -3, 12),
    history: [{ t: dayAtOffset(now, -2), amount: 1 }],
  })
  const comparison = compareWindows(realShape, 28, now)
  const baselineGate = readiness(realShape, now).unlocks.find((unlock) => unlock.id === 'baseline28')
  check(
    'a habit only a few days old has no printable 28-day baseline',
    comparison.enoughHistory === false && baselineGate.ready === false,
    { comparison, baselineGate },
  )
  check('best 28-day window is null below 28 days of age', bestWindow(realShape, 28, now) === null)

  const emptyHistory = habit({ createdAt: dayAtOffset(now, -59, 12) })
  const flatComparison = compareWindows(emptyHistory, 28, now)
  const tiedBest = bestWindow(emptyHistory, 28, now)
  check(
    'equal comparison windows are flat and tied best windows prefer the latest',
    flatComparison.direction === 'flat' &&
      tiedBest.end === new Date(2026, 8, 16).getTime() &&
      tiedBest.start === new Date(2026, 7, 20).getTime(),
    { flatComparison, tiedBest },
  )

  const shortAnalysis = analyzeHabit(realShape, [], now)
  check(
    'the 53-week heatmap prop is not set below 120 days of age',
    shortAnalysis.pace.ageDays < 120 && shortAnalysis.longHeatmapWeeks === null,
    { ageDays: shortAnalysis.pace.ageDays, weeks: shortAnalysis.longHeatmapWeeks },
  )

  const oldEnough = habit({ createdAt: dayAtOffset(now, -119, 12) })
  check(
    'the 53-week heatmap prop is set at 120 days of age',
    analyzeHabit(oldEnough, [], now).longHeatmapWeeks === 53,
  )
}

console.log('\nhabitHeadline priority ladder')
{
  const now = new Date(2026, 8, 16, 12).getTime() // Wednesday
  const fixtures = [
    {
      name: 'scheduled-today nudge wins first',
      fixture: habit({
        createdAt: dayAtOffset(now, -50, 12),
        history: [{ t: dayAtOffset(now, -1), amount: 8 }],
      }),
      expected: 'Today is scheduled',
    },
    {
      name: 'live streak is protected after today is logged',
      fixture: habit({
        createdAt: dayAtOffset(now, -2, 12),
        history: [-1, 0].map((offset) => ({ t: dayAtOffset(now, offset), amount: 1 })),
      }),
      expected: '2-day streak alive',
    },
    {
      name: 'three-day pause is named on an off-day',
      fixture: habit({
        days: [0],
        createdAt: dayAtOffset(now, -20, 12),
        history: [{ t: dayAtOffset(now, -3), amount: 4 }],
      }),
      expected: '3 days paused',
    },
    {
      name: 'eligible 28-day comparison outranks reps remaining',
      fixture: habit({
        days: [4],
        createdAt: dayAtOffset(now, -59, 12),
        history: [
          { t: dayAtOffset(now, -30), amount: 5 },
          { t: dayAtOffset(now, -1), amount: 10 },
        ],
      }),
      expected: '10 reps vs 5 before',
    },
    {
      name: 'reps remaining appears before the empty invitation',
      fixture: habit({
        days: [4],
        createdAt: dayAtOffset(now, -1, 12),
        history: [{ t: dayAtOffset(now, -1), amount: 7 }],
      }),
      expected: '53 reps remain',
    },
    {
      name: 'an empty off-day gets the invitation',
      fixture: habit({ days: [4], createdAt: now }),
      expected: 'No reps yet',
    },
  ]

  const headlines = fixtures.map(({ fixture }) => habitHeadline(fixture, now))
  fixtures.forEach(({ name, expected }, index) => {
    check(name, headlines[index].text.includes(expected), headlines[index])
  })
  check(
    'every headline is one line and at most 90 characters',
    headlines.every(({ text }) => !text.includes('\n') && text.length <= 90),
    headlines,
  )

  const synthetic = Array.from({ length: 14 }, (_, habitIndex) => habit({
    id: `bench-${habitIndex}`,
    createdAt: dayAtOffset(now, -220, 12),
    history: Array.from({ length: 200 }, (_, eventIndex) => ({
      t: dayAtOffset(now, -eventIndex),
      amount: 1,
    })),
  }))
  const started = performance.now()
  for (const fixture of synthetic) habitHeadline(fixture, now)
  const elapsed = performance.now() - started
  console.log(`  benchmark 14 habits × 200 events: ${elapsed.toFixed(3)}ms`)
  check('headline batch stays under 50ms', elapsed < 50, { elapsed })
}

console.log('\ndayCompletion')
{
  const now = new Date(2026, 8, 16, 12).getTime() // Wednesday
  const habits = [
    habit({
      id: 'hit',
      createdAt: new Date(2026, 8, 1, 12).getTime(),
      history: [{ t: new Date(2026, 8, 16, 8).getTime(), amount: 1 }],
    }),
    habit({ id: 'pending', createdAt: new Date(2026, 8, 1, 12).getTime() }),
    habit({ id: 'off', days: [1], createdAt: new Date(2026, 8, 1, 12).getTime() }),
    habit({ id: 'future', createdAt: new Date(2026, 8, 17, 12).getTime() }),
  ]
  const completion = dayCompletion(habits, now, now)
  check('completion excludes off-day and not-yet-created habits', completion.scheduled === 2, completion)
  check('completion reports hit percentage and pending today', completion.hit === 1 && completion.pct === 0.5 && completion.pending, completion)
}

console.log('\nreadiness')
{
  const now = new Date(2026, 8, 16, 12).getTime()
  const gateIds = ['forecast', 'momentum', 'hitRate28', 'timeOfDay', 'weekdayPattern']
  gateIds.push('baseline28', 'monthOverMonth')

  const newHabit = habit({
    title: 'One rep, four days old',
    createdAt: dayAtOffset(now, -3, 12),
    history: [{ t: dayAtOffset(now, -3), amount: 1 }],
  })
  const newState = readiness(newHabit, now)
  const newGates = Object.fromEntries(newState.unlocks.map((unlock) => [unlock.id, unlock]))
  check(
    'brand-new fixture exposes exactly the currently-computable gates',
    newState.unlocks.map((unlock) => unlock.id).join() === gateIds.join(),
    newState,
  )
  check(
    'one rep at four days keeps every analytical read locked',
    newState.unlocks.every((unlock) => unlock.ready === false),
    newState,
  )
  check(
    'every locked read has a finite best-case ETA',
    newState.unlocks.every((unlock) => Number.isInteger(unlock.etaDays) && unlock.etaDays >= 0),
    newState,
  )
  check(
    'brand-new ETAs account for schedule and calendar age',
    newGates.forecast.etaDays === 1 &&
      newGates.momentum.etaDays === 7 &&
      newGates.hitRate28.etaDays === 6 &&
      newGates.timeOfDay.etaDays === 6 &&
      newGates.weekdayPattern.etaDays === 17,
    newState,
  )

  const halfwayHabit = habit({
    title: 'Halfway samples',
    days: [1, 3, 5],
    createdAt: dayAtOffset(now, -10, 12),
    history: [-9, -6, -4, 0].map((offset) => ({ t: dayAtOffset(now, offset), amount: 1 })),
  })
  const halfwayState = readiness(halfwayHabit, now)
  const halfway = Object.fromEntries(halfwayState.unlocks.map((unlock) => [unlock.id, unlock]))
  check(
    'halfway fixture reports the actual sample counts for every remaining gate',
    halfway.momentum.have === 1 && halfway.momentum.want === 2 &&
      halfway.hitRate28.have === 5 && halfway.hitRate28.want === 10 &&
      halfway.timeOfDay.have === 4 && halfway.timeOfDay.want === 8 &&
      halfway.weekdayPattern.have === 11 && halfway.weekdayPattern.want === 21,
    halfwayState,
  )
  check(
    'halfway fixture keeps only the already-earned forecast ready',
    halfway.forecast.ready &&
      ['momentum', 'hitRate28', 'timeOfDay', 'weekdayPattern'].every((id) => !halfway[id].ready),
    halfwayState,
  )

  const seasonedHistory = []
  let extraTuesdays = 0
  for (let offset = -83; offset <= 0; offset++) {
    const t = dayAtOffset(now, offset)
    const weekday = new Date(t).getDay()
    const regularDay = weekday === 1 || weekday === 3 || weekday === 5
    const sampledTuesday = weekday === 2 && extraTuesdays < 5
    if (regularDay || sampledTuesday) {
      seasonedHistory.push({ t, amount: 1 })
      if (sampledTuesday) extraTuesdays++
    }
  }
  const seasonedHabit = habit({
    title: 'Ninety-day habit',
    createdAt: dayAtOffset(now, -89, 12),
    history: seasonedHistory,
  })
  const seasonedState = readiness(seasonedHabit, now)
  check(
    'ninety-day fixture meets all currently-computable gates',
    seasonedState.totalReps >= 40 && seasonedState.unlocks.every((unlock) => unlock.ready && unlock.etaDays === 0),
    seasonedState,
  )
  const seasonedInsights = analyzeHabit(seasonedHabit, [], now).insights.map((insight) => insight.id)
  check(
    'well-populated habit keeps its established forecast and pattern insights',
    ['forecast', 'weekday-pattern', 'time-of-day'].every((id) => seasonedInsights.includes(id)),
    seasonedInsights,
  )
}

console.log('\ninsights')
{
  const now = new Date(2026, 8, 16, 12).getTime()
  const cases = [
    {
      fixture: habit({
        title: 'Two reps',
        createdAt: new Date(2026, 8, 14, 12).getTime(),
        history: [
          { t: new Date(2026, 8, 14, 8).getTime(), amount: 1 },
          { t: new Date(2026, 8, 15, 8).getTime(), amount: 1 },
        ],
      }),
      expectedIds: ['warming-up'],
    },
    {
      fixture: habit({
        title: 'Three-rep run',
        createdAt: new Date(2026, 8, 13, 12).getTime(),
        history: [
          { t: new Date(2026, 8, 13, 8).getTime(), amount: 1 },
          { t: new Date(2026, 8, 14, 8).getTime(), amount: 1 },
          { t: new Date(2026, 8, 15, 8).getTime(), amount: 1 },
        ],
      }),
      expectedIds: ['forecast', 'best-streak'],
    },
  ]

  for (const { fixture, expectedIds } of cases) {
    const actualIds = analyzeHabit(fixture, [], now).insights.map((insight) => insight.id)
    check(`${fixture.title} fires the expected insight rules`, actualIds.join() === expectedIds.join(), { actualIds, expectedIds })
  }
  check(
    'warming-up fires below three total reps',
    analyzeHabit(cases[0].fixture, [], now).pace.totalReps < 3 &&
      analyzeHabit(cases[0].fixture, [], now).insights.some((insight) => insight.id === 'warming-up'),
  )
}

console.log('\nmeaning-layer insights')
{
  const now = new Date(2026, 8, 16, 12).getTime()
  const strongerRecent = habit({
    title: 'Stronger recent baseline',
    createdAt: dayAtOffset(now, -70, 12),
    history: [
      ...[-55, -48, -41, -34].map((offset) => ({ t: dayAtOffset(now, offset), amount: 1 })),
      ...[-27, -24, -21, -18, -15, -12, -9, -6, -3, 0].map((offset) => ({ t: dayAtOffset(now, offset), amount: 1 })),
    ],
  })
  const weakerRecent = habit({
    title: 'Weaker recent baseline',
    createdAt: dayAtOffset(now, -70, 12),
    history: [
      ...[-55, -52, -49, -46, -43, -40, -37, -34, -31, -28].map((offset) => ({ t: dayAtOffset(now, offset), amount: 1 })),
      ...[-21, -14, -7, 0].map((offset) => ({ t: dayAtOffset(now, offset), amount: 1 })),
    ],
  })
  const strongerInsights = analyzeHabit(strongerRecent, [], now).insights
  const weakerInsights = analyzeHabit(weakerRecent, [], now).insights
  check('an improving 28-day baseline emits baseline-better', strongerInsights.some((insight) => insight.id === 'baseline-better'), strongerInsights)
  check(
    'a declining 28-day baseline emits baseline-worse with a best-window action',
    weakerInsights.some((insight) => insight.id === 'baseline-worse' && insight.action?.includes('stretch')),
    weakerInsights,
  )
  check('eligible history emits the best-window insight', strongerInsights.some((insight) => insight.id === 'best-window'), strongerInsights)

  const monthlyHistory = []
  for (let day = 1; day <= 10; day++) monthlyHistory.push({ t: new Date(2026, 6, day, 8).getTime(), amount: 1 })
  for (let day = 1; day <= 20; day++) monthlyHistory.push({ t: new Date(2026, 7, day, 8).getTime(), amount: 1 })
  for (let day = 1; day <= 16; day++) monthlyHistory.push({ t: new Date(2026, 8, day, 8).getTime(), amount: 1 })
  const monthHabit = habit({
    title: 'Month-over-month fixture',
    createdAt: new Date(2026, 5, 1, 12).getTime(),
    history: monthlyHistory,
  })
  const monthInsights = analyzeHabit(monthHabit, [], now).insights
  check('two complete months emit month-over-month', monthInsights.some((insight) => insight.id === 'month-over-month'), monthInsights)

  const portfolioHabits = [
    habit({
      id: 'risk-a',
      createdAt: dayAtOffset(now, -30, 12),
      history: [{ t: dayAtOffset(now, -10), amount: 3 }],
    }),
    habit({
      id: 'risk-b',
      createdAt: dayAtOffset(now, -30, 12),
      history: [{ t: dayAtOffset(now, -20), amount: 1 }],
    }),
  ]
  const emitted = [
    ...strongerInsights,
    ...weakerInsights,
    ...monthInsights,
    ...analytics.analyzePortfolio(portfolioHabits, now).insights,
  ]
  const warnings = emitted.filter((insight) => insight.tone === 'warn')
  check(
    'every emitted warning insight has a concrete action',
    warnings.length > 0 && warnings.every((insight) => typeof insight.action === 'string' && insight.action.length > 0),
    warnings,
  )
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
