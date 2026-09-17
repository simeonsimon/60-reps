import { useMemo } from 'react'
import ClimbChart from '../ClimbChart.jsx'
import Heatmap from '../Heatmap.jsx'
import { GOAL, isScheduledOn } from '../../lib/habits.js'
import { analyzeHabit, fmtDate, pctLabel } from '../../lib/analytics.js'
import { readiness as getReadiness } from '../../lib/analytics/metrics.js'
import { Stat, Section, InsightCard } from './primitives.jsx'
import ForecastCard from './ForecastCard.jsx'
import { WeeklyBars, MonthBars, WeekdayBars, DayPartsBar } from './bars.jsx'
import ReadinessCard, { LockedStrip, unlockTiming } from './ReadinessCard.jsx'

// The "This habit" tab: switcher chips, vitals, forecast, conclusions, patterns.
export default function HabitAnalytics({ habit, habits, accent, onSelect }) {
  const { A, R } = useMemo(() => {
    const now = Date.now()
    return { A: analyzeHabit(habit, habits, now), R: getReadiness(habit, now) }
  }, [habit, habits])

  // The forecast has its own hero card, so keep it out of the conclusions list.
  const conclusions = A.insights.filter((i) => i.id !== 'forecast' && i.id !== 'summit')
  const weekDelta = A.pace.last7 - A.pace.prev7
  const gates = Object.fromEntries(R.unlocks.map((unlock) => [unlock.id, unlock]))
  const hitRateLabel = A.w28.spanDays < 28 ? 'Hit rate · since you started' : 'Hit rate · 4 wks'
  const consistencyReady = gates.hitRate28.ready && gates.momentum.ready
  const consistencyEta = [gates.hitRate28.etaDays, gates.momentum.etaDays].includes(null)
    ? null
    : Math.max(gates.hitRate28.etaDays, gates.momentum.etaDays)

  return (
    <>
      {habits.length > 1 && (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {habits.map((h) => {
            const on = h.id === habit.id
            return (
              <button
                key={h.id}
                onClick={() => onSelect(h.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on ? 'border-accent bg-accent-soft text-accent' : 'border-line/5 bg-surface text-muted'
                }`}
              >
                <span>{h.emoji || '⛰️'}</span>
                <span className="max-w-[8.5rem] truncate">{h.title}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Vital signs */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Reps banked" value={`${Math.min(habit.reps, GOAL)}/${GOAL}`} sub={habit.reps > GOAL ? `+${habit.reps - GOAL} bonus` : undefined} subTone="up" />
        <Stat label="Streak" value={`${A.streak}d`} sub={A.streak > 0 && A.streak >= A.longest ? 'personal best' : undefined} subTone="up" />
        <Stat label="Best streak" value={`${A.longest}d`} />
        <Stat
          label={hitRateLabel}
          value={gates.hitRate28.ready ? pctLabel(A.w28.rate) : '🔒'}
          sub={
            gates.hitRate28.ready
              ? `${A.w28.hit}/${A.w28.scheduled} days`
              : `${gates.hitRate28.have}/${gates.hitRate28.want} scheduled · ${unlockTiming(gates.hitRate28)}`
          }
        />
        <Stat
          label="This week"
          value={A.pace.last7}
          sub={
            gates.momentum.ready
              ? `${weekDelta > 0 ? '+' : ''}${weekDelta} vs last`
              : `${gates.momentum.have}/${gates.momentum.want} comparison reps · ${unlockTiming(gates.momentum)}`
          }
          subTone={gates.momentum.ready ? (weekDelta > 0 ? 'up' : weekDelta < 0 ? 'down' : undefined) : undefined}
        />
        <Stat
          label="Consistency"
          value={consistencyReady ? A.score.score : '🔒'}
          sub={
            consistencyReady
              ? A.score.label
              : `needs hit rate + momentum · ${unlockTiming({ ready: false, etaDays: consistencyEta })}`
          }
          subTone={consistencyReady ? (A.score.score >= 65 ? 'up' : A.score.score < 45 ? 'down' : undefined) : undefined}
        />
      </div>

      {A.fc.done || gates.forecast.ready ? (
        <ForecastCard habit={habit} fc={A.fc} />
      ) : (
        <LockedStrip unlock={gates.forecast} data={R} />
      )}

      <Section title="The long view" hint="last 12 months">
        <div className="space-y-3">
          <div className="rounded-3xl bg-surface p-4">
            <MonthBars series={A.months} unlock={gates.monthOverMonth} readiness={R} />
          </div>

          {gates.baseline28.ready ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="This month"
                value={A.compare28.current.reps}
                sub={A.compare28.current.rate === null ? 'no scheduled days' : `${pctLabel(A.compare28.current.rate)} hit rate`}
                subTone={A.compare28.direction === 'up' ? 'up' : A.compare28.direction === 'down' ? 'down' : undefined}
              />
              <Stat
                label="Last month"
                value={A.compare28.prior.reps}
                sub={A.compare28.prior.rate === null ? 'no scheduled days' : `${pctLabel(A.compare28.prior.rate)} hit rate`}
              />
              <Stat
                label="Best 28 days"
                value={A.best28 ? `${A.best28.reps} reps` : '—'}
                sub={A.best28 ? `${fmtDate(A.best28.start)} – ${fmtDate(A.best28.end)}` : undefined}
                subTone="up"
              />
            </div>
          ) : (
            <LockedStrip unlock={gates.baseline28} data={R} />
          )}

          {A.longHeatmapWeeks ? (
            <div className="rounded-3xl bg-surface p-4">
              <div className="mb-3 text-xs font-semibold text-muted">Year consistency</div>
              <Heatmap
                events={habit.history}
                accent={accent}
                isScheduled={(d) => isScheduledOn(habit, d)}
                weeks={A.longHeatmapWeeks}
              />
            </div>
          ) : null}
        </div>
      </Section>

      <ReadinessCard data={R} />

      <Section title="Conclusions" hint="read from your history">
        <div className="space-y-2.5">
          {conclusions.length > 0 ? (
            conclusions.map((ins, i) => <InsightCard key={ins.id} ins={ins} index={i} />)
          ) : (
            <p className="rounded-3xl bg-surface p-4 text-xs text-muted">
              Keep logging — conclusions appear as soon as real patterns emerge.
            </p>
          )}
        </div>
      </Section>

      <Section title="Momentum" hint="reps per week">
        <div className="rounded-3xl bg-surface p-4">
          <WeeklyBars series={A.weekly} unlock={gates.momentum} readiness={R} />
        </div>
      </Section>

      <Section title="Patterns">
        <div className="space-y-3">
          <div className="rounded-3xl bg-surface p-4">
            <div className="mb-3 text-xs font-semibold text-muted">By weekday</div>
            <WeekdayBars wk={A.wk} unlock={gates.weekdayPattern} readiness={R} />
          </div>
          <div className="rounded-3xl bg-surface p-4">
            <div className="mb-3 text-xs font-semibold text-muted">By time of day</div>
            <DayPartsBar parts={A.parts} unlock={gates.timeOfDay} readiness={R} />
          </div>
        </div>
      </Section>

      <Section title="The climb" hint={habit.title}>
        <div className="rounded-3xl bg-surface p-4">
          <ClimbChart events={habit.history} accent={accent} goal={GOAL} />
        </div>
      </Section>

      <Section title="Consistency" hint="last 17 weeks">
        <div className="rounded-3xl bg-surface p-4">
          <Heatmap events={habit.history} accent={accent} isScheduled={(d) => isScheduledOn(habit, d)} />
        </div>
      </Section>

      <Section title="Records">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Biggest day"
            value={A.rec.bestDay ? `${A.rec.bestDay.reps} reps` : '—'}
            sub={A.rec.bestDay ? fmtDate(A.rec.bestDay.date) : undefined}
          />
          <Stat label="Active days" value={A.rec.activeDays} sub={`of ${A.pace.ageDays} tracked`} />
          <Stat label="Avg per active day" value={A.rec.activeDays ? A.rec.avgPerActive.toFixed(1) : '—'} />
          <Stat
            label="Longest pause"
            value={A.rec.longestPause > 0 ? `${A.rec.longestPause}d` : '—'}
            sub={A.rec.longestPause > 0 ? 'paused, never reset' : undefined}
          />
        </div>
      </Section>
    </>
  )
}
