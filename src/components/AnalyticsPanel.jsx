import { useSkin } from '../context/SkinContext.jsx'
import { useStore } from '../store/StoreProvider.jsx'
import ClimbChart from './ClimbChart.jsx'
import Heatmap from './Heatmap.jsx'
import { currentStreak, isScheduledOn, GOAL } from '../lib/habits.js'

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

export default function AnalyticsPanel({ habit }) {
  const { def } = useSkin()
  const { habits } = useStore()
  const accent = def.palette.accent
  if (!habit) return null

  const lifetime = habits.reduce((s, h) => s + h.reps, 0)
  const streak = currentStreak(habit)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Lifetime reps" value={lifetime} />
        <Stat label="This habit" value={`${Math.min(habit.reps, GOAL)}/${GOAL}`} />
        <Stat label="Streak" value={`${streak}d`} />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <span>Climb Chart</span>
          <span className="text-xs font-normal text-muted">· {habit.title}</span>
        </div>
        <div className="rounded-3xl bg-surface p-4">
          <ClimbChart events={habit.history} accent={accent} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-ink">Consistency</div>
        <div className="rounded-3xl bg-surface p-4">
          <Heatmap events={habit.history} accent={accent} isScheduled={(d) => isScheduledOn(habit, d)} />
        </div>
      </div>
    </div>
  )
}
