import { useState } from 'react'
import { useStore } from '../store/StoreProvider.jsx'
import { HABIT_TYPES } from '../lib/habits.js'

const EMOJIS = ['⛰️', '🏀', '🧪', '🏍️', '📚', '🏃', '💧', '🎸', '🧘', '🛏️', '🥗', '✍️']

function slug(s) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'habit'
  )
}

export default function AddHabitPanel({ onClose }) {
  const { addHabit } = useStore()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('single')
  const [emoji, setEmoji] = useState('⛰️')
  const [target, setTarget] = useState(50)
  const [unit, setUnit] = useState('reps')

  const canSave = title.trim().length > 0 && (type !== 'progress' || target > 0)

  function save() {
    if (!canSave) return
    const now = Date.now()
    const habit = {
      id: `${slug(title)}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      type,
      emoji,
      reps: 0,
      history: [],
      createdAt: now,
      sessionValue: 0,
      lastCompletedAt: null,
    }
    if (type === 'progress') {
      habit.target = Number(target)
      habit.unit = unit.trim() || 'reps'
      habit.step = Math.max(1, Math.round(Number(target) / 5))
    }
    addHabit(habit)
    onClose?.()
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Read 10 pages"
          className="w-full rounded-2xl border border-white/10 bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">Icon</label>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-10 w-10 place-items-center rounded-xl text-xl transition-colors ${
                emoji === e ? 'bg-accent-soft ring-1 ring-accent' : 'bg-surface'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">Type</label>
        <div className="space-y-2">
          {HABIT_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                type === t.id ? 'border-accent bg-accent-soft' : 'border-white/5 bg-surface'
              }`}
            >
              <div>
                <div className="text-sm font-semibold text-ink">{t.label}</div>
                <div className="text-xs text-muted">{t.hint}</div>
              </div>
              {type === t.id && <span className="text-accent">●</span>}
            </button>
          ))}
        </div>
      </div>

      {type === 'progress' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">Target / session</label>
            <input
              type="number"
              min="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-surface px-4 py-3 text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">Unit</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="min, pages…"
              className="w-full rounded-2xl border border-white/10 bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-2xl bg-accent px-4 py-3.5 text-sm font-bold disabled:opacity-40"
        style={{ color: 'rgb(var(--c-base))' }}
      >
        Start the climb
      </button>
    </div>
  )
}
