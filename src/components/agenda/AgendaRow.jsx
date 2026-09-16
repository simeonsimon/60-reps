import { memo, useEffect, useState } from 'react'
import { audio } from '../../audio/AudioEngine.js'
import { GOAL, completedToday, isScheduledToday, sessionPct } from '../../lib/habits.js'
import { habitHeadline } from '../../lib/analytics/insights.js'
import { EmojiTile, HabitHeadline } from '../analytics/primitives.jsx'

function AgendaRow({
  habit,
  index,
  anchorTitle,
  anchorDone,
  complete,
  updateHabit,
  onFocus,
  onUnlock,
}) {
  const [undoSnapshot, setUndoSnapshot] = useState(null)
  const doneToday = completedToday(habit)
  const restDay = !isScheduledToday(habit)
  const waitingForAnchor = !!habit.anchorId && !anchorDone
  const headline = habitHeadline(habit)

  useEffect(() => {
    if (!undoSnapshot) return undefined
    const timer = setTimeout(() => setUndoSnapshot(null), 5000)
    return () => clearTimeout(timer)
  }, [undoSnapshot])

  function handleComplete() {
    audio.resume()
    const snapshot = {
      reps: habit.reps,
      history: habit.history,
      lastCompletedAt: habit.lastCompletedAt,
      sessionValue: habit.sessionValue,
    }
    const result = complete(habit.id)

    if (result.meta.blocked) {
      audio.blocked()
      return
    }

    setUndoSnapshot(snapshot)
    if (result.meta.repsGained > 0) {
      if (habit.reps < GOAL && habit.reps + result.meta.repsGained >= GOAL) audio.summit()
      else audio.complete()
    } else {
      audio.tick()
    }

    if (result.unlocked?.length) {
      audio.achievement()
      onUnlock?.(result.unlocked)
    }
  }

  function handleUndo() {
    if (!undoSnapshot) return
    updateHabit(habit.id, undoSnapshot)
    setUndoSnapshot(null)
    // Known limitation: achievements unlocked by the undone rep stay unlocked.
  }

  return (
    <div className="flex min-h-[4.5rem] items-center gap-2 rounded-3xl border border-line/10 bg-surface/80 px-2.5 py-2">
      <button
        type="button"
        onClick={handleComplete}
        aria-label={`${doneToday ? 'Log another rep for' : 'Log'} ${habit.title}`}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-[transform,opacity,background-color,border-color] active:scale-90 ${
          doneToday ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-base text-transparent'
        } ${waitingForAnchor ? 'opacity-45' : 'opacity-100'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none">
          <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onFocus(index)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`Open ${habit.title}`}
      >
        <EmojiTile emoji={habit.emoji || '⛰️'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold text-ink">{habit.title}</span>
            <span className="shrink-0 text-xs2 font-semibold text-muted">{habit.reps} / {GOAL}</span>
          </span>
          <HabitHeadline headline={headline} className="mt-1" />

          {(restDay || waitingForAnchor) && (
            <span className="mt-1 flex min-w-0 flex-wrap gap-1">
              {restDay && (
                <span className="rounded-full bg-elevated px-2 py-0.5 text-2xs font-medium text-muted">💤 Rest day</span>
              )}
              {waitingForAnchor && (
                <span className="max-w-full truncate rounded-full bg-elevated px-2 py-0.5 text-2xs font-medium text-muted">
                  ⛓ after {anchorTitle || 'anchor'}
                </span>
              )}
            </span>
          )}

          {habit.type === 'progress' && (
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-elevated">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${sessionPct(habit) * 100}%` }}
              />
            </span>
          )}
        </span>
      </button>

      {undoSnapshot && (
        <button
          type="button"
          onClick={handleUndo}
          className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1.5 text-xs font-bold text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Undo
        </button>
      )}
    </div>
  )
}

export default memo(AgendaRow)
