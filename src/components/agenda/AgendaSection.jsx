import AgendaRow from './AgendaRow.jsx'
import { completedToday } from '../../lib/habits.js'

export default function AgendaSection({
  group,
  indexById,
  habitById,
  complete,
  updateHabit,
  onFocus,
  onUnlock,
}) {
  return (
    <section aria-labelledby={`agenda-${group.id}`}>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 id={`agenda-${group.id}`} className="font-display text-sm font-extrabold text-ink">
          {group.label}
        </h2>
        <span className="text-xs2 text-muted">{group.hint}</span>
        <span className="ml-auto text-xs2 font-semibold text-muted">{group.habits.length}</span>
      </div>
      <div className="space-y-2">
        {group.habits.map((habit) => {
          const anchor = habit.anchorId ? habitById.get(habit.anchorId) : null
          return (
            <AgendaRow
              key={habit.id}
              habit={habit}
              index={indexById.get(habit.id)}
              anchorTitle={anchor?.title}
              anchorDone={anchor ? completedToday(anchor) : !habit.anchorId}
              complete={complete}
              updateHabit={updateHabit}
              onFocus={onFocus}
              onUnlock={onUnlock}
            />
          )
        })}
      </div>
    </section>
  )
}
