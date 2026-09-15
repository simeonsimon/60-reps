import { useMemo } from 'react'
import ClimbChart from '../ClimbChart.jsx'
import Heatmap from '../Heatmap.jsx'
import { GOAL, isScheduledOn } from '../../lib/habits.js'
import { analyzeHabit, fmtDate, pctLabel } from '../../lib/analytics.js'
import { Stat, Section, InsightCard } from './primitives.jsx'
import ForecastCard from './ForecastCard.jsx'
import { WeeklyBars, WeekdayBars, DayPartsBar } from './bars.jsx'

// The "This habit" tab: switcher chips, vitals, forecast, conclusions, patterns.
export default function HabitAnalytics({ habit, habits, accent, onSelect }) {
  const A = useMemo(() => analyzeHabit(habit, habits), [habit, habits])

  // The forecast has its own hero card, so keep it out of the conclusions list.
  const conclusions = A.insights.filter((i) => i.id !== 'forecast' && i.id !== 'summit')
  const weekDelta = A.pace.last7 - A.pace.prev7

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
        <Stat label="Hit rate · 4 wks" value={A.w28.rate === null ? '—' : pctLabel(A.w28.rate)} sub={A.w28.scheduled > 0 ? `${A.w28.hit}/${A.w28.scheduled} days` : undefined} />
        <Stat
          label="This week"
          value={A.pace.last7}
          sub={`${weekDelta > 0 ? '+' : ''}${weekDelta} vs last`}
          subTone={weekDelta > 0 ? 'up' : weekDelta < 0 ? 'down' : undefined}
        />
        <Stat label="Consistency" value={A.score.score} sub={A.score.label} subTone={A.score.score >= 65 ? 'up' : A.score.score < 45 ? 'down' : undefined} />
      </div>

      <ForecastCard habit={habit} fc={A.fc} />

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
          <WeeklyBars series={A.weekly} />
        </div>
      </Section>

      <Section title="Patterns">
        <div className="space-y-3">
          <div className="rounded-3xl bg-surface p-4">
            <div className="mb-3 text-xs font-semibold text-muted">By weekday</div>
            <WeekdayBars wk={A.wk} />
          </div>
          <div className="rounded-3xl bg-surface p-4">
            <div className="mb-3 text-xs font-semibold text-muted">By time of day</div>
            <DayPartsBar parts={A.parts} />
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
