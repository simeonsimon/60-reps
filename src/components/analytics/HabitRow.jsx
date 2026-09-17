import { GOAL } from '../../lib/habits.js'
import { EmojiTile } from './primitives.jsx'

function scoreChipStyle(score) {
  if (score >= 65) return { background: 'rgb(var(--c-accent) / 0.16)', color: 'rgb(var(--c-accent))' }
  if (score >= 45) return { background: 'rgb(var(--c-star) / 0.14)', color: 'rgb(var(--c-star))' }
  return { background: 'rgb(var(--c-elevated))', color: 'rgb(var(--c-muted))' }
}

// One row in the "All habits" comparison list.
export default function HabitRow({ entry, onOpen }) {
  const h = entry.habit
  const pct = Math.min(100, (h.reps / GOAL) * 100)
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-3xl border border-line/5 bg-surface p-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-2.5">
        <EmojiTile emoji={h.emoji || '⛰️'} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{h.title}</span>
        <span
          className="rounded-full px-2 py-0.5 text-2xs font-bold"
          style={scoreChipStyle(entry.score.score)}
        >
          {entry.score.score}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs2 text-muted">
        <span>
          {Math.min(h.reps, GOAL)}/{GOAL}
          {h.reps > GOAL ? ` (+${h.reps - GOAL})` : ''}
        </span>
        {entry.streak > 0 && <span className="font-semibold text-accent">🔥 {entry.streak}d</span>}
        {entry.pace.last7 > 0 && <span>{entry.pace.last7} this week</span>}
        <span className="ml-auto">{entry.score.label}</span>
      </div>
    </button>
  )
}
