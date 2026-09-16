import { memo, useMemo } from 'react'
import { useHabits } from '../../store/StoreProvider.jsx'
import { groupBySlot } from '../../lib/slots.js'
import AgendaSection from './AgendaSection.jsx'
import DayStrip from './DayStrip.jsx'

function AgendaView({ onFocus, onUnlock }) {
  const { habits, complete, updateHabit } = useHabits()
  const groups = useMemo(() => groupBySlot(habits), [habits])
  const indexById = useMemo(() => new Map(habits.map((habit, index) => [habit.id, index])), [habits])
  const habitById = useMemo(() => new Map(habits.map((habit) => [habit.id, habit])), [habits])
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)' }}>
      <div className="mx-auto max-w-lg pb-5">
        <div className="mb-4 px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Today’s climb</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Your agenda</h1>
          <p className="mt-1 text-sm text-muted">{todayLabel}</p>
        </div>

        <DayStrip habits={habits} />

        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <AgendaSection
              key={group.id}
              group={group}
              indexById={indexById}
              habitById={habitById}
              complete={complete}
              updateHabit={updateHabit}
              onFocus={onFocus}
              onUnlock={onUnlock}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default memo(AgendaView)
