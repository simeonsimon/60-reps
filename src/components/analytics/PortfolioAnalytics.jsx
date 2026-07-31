import { useMemo } from 'react'
import { analyzePortfolio } from '../../lib/analytics.js'
import { Stat, Section, InsightCard } from './primitives.jsx'
import { WeeklyBars } from './bars.jsx'
import HabitRow from './HabitRow.jsx'

// The "All habits" tab: portfolio vitals, cross-habit conclusions, comparison list.
export default function PortfolioAnalytics({ habits, onOpenHabit }) {
  const P = useMemo(() => analyzePortfolio(habits), [habits])

  return (
    <>
      {/* Portfolio vitals */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Lifetime reps" value={P.totalReps} sub={`across ${habits.length} habit${habits.length === 1 ? '' : 's'}`} />
        <Stat
          label="This week"
          value={P.thisWeek}
          sub={`${P.thisWeek - P.lastWeek >= 0 ? '+' : ''}${P.thisWeek - P.lastWeek} vs last`}
          subTone={P.thisWeek > P.lastWeek ? 'up' : P.thisWeek < P.lastWeek ? 'down' : undefined}
        />
        <Stat label="Summits reached" value={P.summits} sub={`of ${habits.length} climbs`} />
        <Stat label="Live streaks" value={P.activeStreaks} sub="2+ days running" />
      </div>

      <Section title="Conclusions" hint="across every habit">
        <div className="space-y-2.5">
          {P.insights.length > 0 ? (
            P.insights.map((ins, i) => <InsightCard key={ins.id} ins={ins} index={i} />)
          ) : (
            <p className="rounded-3xl bg-surface p-4 text-xs text-muted">
              Keep logging — cross-habit conclusions appear as patterns emerge.
            </p>
          )}
        </div>
      </Section>

      <Section title="Total output" hint="reps per week, all habits">
        <div className="rounded-3xl bg-surface p-4">
          <WeeklyBars series={P.weekly} />
        </div>
      </Section>

      <Section title="Habits compared" hint="tap one to inspect">
        <div className="space-y-2.5">
          {[...P.perHabit]
            .sort((a, b) => b.score.score - a.score.score)
            .map((entry) => (
              <HabitRow key={entry.habit.id} entry={entry} onOpen={() => onOpenHabit(entry.habit.id)} />
            ))}
        </div>
      </Section>
    </>
  )
}
