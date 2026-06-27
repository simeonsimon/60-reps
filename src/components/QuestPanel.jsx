import { useMemo } from 'react'
import { useStore } from '../store/StoreProvider.jsx'
import { generateQuest, unlockedChapters, nextChapter } from '../quests/questGenerator.js'
import PremiumGate from './PremiumGate.jsx'

export default function QuestPanel({ habit }) {
  const { premium } = useStore()
  const quest = useMemo(() => (habit ? generateQuest(habit) : null), [habit?.id, habit?.title])
  if (!habit || !quest) return null

  if (!premium) {
    return <PremiumGate feature="Custom AI Quests" blurb="Every habit becomes a story that unfolds one chapter every 5 reps, written for its title." />
  }

  const unlocked = unlockedChapters(quest, habit)
  const next = nextChapter(quest, habit)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{quest.title}</p>

      <div className="space-y-3">
        {unlocked.map((c) => (
          <article key={c.index} className="animate-fade-up rounded-3xl border border-white/5 bg-surface p-4">
            <h4 className="mb-1 font-display text-sm font-bold text-accent">{c.title}</h4>
            <p className="text-sm leading-relaxed text-ink/90">{c.text}</p>
          </article>
        ))}
      </div>

      {next ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-surface/40 p-4 text-center">
          <div className="text-sm font-semibold text-muted">🔒 {next.title}</div>
          <div className="mt-1 text-xs text-muted">
            Unlocks at {next.unlockAtReps} reps — {next.unlockAtReps - habit.reps} to go
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-accent-soft p-4 text-center text-sm font-semibold text-accent">
          ✦ The quest is complete. Every chapter is yours.
        </div>
      )}
    </div>
  )
}
