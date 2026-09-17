import { useState } from 'react'
import { useSkin } from '../context/SkinContext.jsx'
import { useHabits } from '../store/StoreProvider.jsx'
import HabitAnalytics from './analytics/HabitAnalytics.jsx'
import PortfolioAnalytics from './analytics/PortfolioAnalytics.jsx'

// Shell only: tab + selection state. The heavy rendering lives in
// analytics/HabitAnalytics.jsx and analytics/PortfolioAnalytics.jsx.
export default function AnalyticsPanel({ habit }) {
  const { def } = useSkin()
  const { habits } = useHabits()
  const [tab, setTab] = useState('habit')
  const [selId, setSelId] = useState(habit?.id)

  const sel = habits.find((h) => h.id === selId) || habit || habits[0]

  if (!sel) return <p className="py-8 text-center text-sm text-muted">Add a habit to see its analysis.</p>

  return (
    <div className="space-y-5">
      {/* View switch */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        {[
          ['habit', 'This habit'],
          ['all', 'All habits'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="rounded-full px-3 py-2 text-sm font-semibold transition-colors"
            style={
              tab === id
                ? { background: 'rgb(var(--c-accent))', color: 'rgb(var(--c-accent-contrast))' }
                : { color: 'rgb(var(--c-muted))' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'habit' ? (
        <HabitAnalytics habit={sel} habits={habits} accent={def.palette.accent} onSelect={setSelId} />
      ) : (
        <PortfolioAnalytics
          habits={habits}
          onOpenHabit={(id) => {
            setSelId(id)
            setTab('habit')
          }}
        />
      )}
    </div>
  )
}
