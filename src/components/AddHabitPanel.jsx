import { useState } from 'react'
import { useStore } from '../store/StoreProvider.jsx'
import { HABIT_TYPES, WEEKDAY_ORDER, WEEKDAY_SHORT } from '../lib/habits.js'
import { TEMPLATES } from '../data/templates.js'

const EMOJIS = ['⛰️', '🏀', '🧪', '🏍️', '📚', '🏃', '💧', '🎸', '🧘', '🛏️', '🥗', '✍️', '💪', '⚡', '🃏', '📖']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

function slug(s) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'habit'
  )
}

function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">{children}</label>
}

export default function AddHabitPanel({ onClose }) {
  const { addHabit, habits } = useStore()
  const [template, setTemplate] = useState(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('single')
  const [emoji, setEmoji] = useState('⛰️')
  const [target, setTarget] = useState(50)
  const [unit, setUnit] = useState('reps')
  const [days, setDays] = useState(ALL_DAYS)
  const [anchorId, setAnchorId] = useState(null)
  const [reminderTime, setReminderTime] = useState('')

  const canSave = title.trim().length > 0 && (type !== 'progress' || target > 0) && days.length > 0

  // One tap fills the whole form from a template; "Start the climb" is tap two.
  function applyTemplate(t) {
    setTemplate(t.id)
    setTitle(t.title)
    setType(t.type)
    setEmoji(t.emoji)
    setDays(t.days ? [...t.days] : ALL_DAYS)
    setReminderTime(t.reminder || '')
    if (t.type === 'progress') {
      setTarget(t.target)
      setUnit(t.unit || 'reps')
    }
  }

  function toggleDay(d) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
  }

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
    if (days.length > 0 && days.length < 7) habit.days = [...days].sort()
    if (anchorId) habit.anchorId = anchorId
    if (reminderTime) habit.reminder = { time: reminderTime, enabled: true }
    addHabit(habit)
    onClose?.()
  }

  return (
    <div className="space-y-5">
      {/* ── Quick start: tap a life, tap Start ─────────────────────────── */}
      <div>
        <Label>Quick start</Label>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                template === t.id ? 'border-accent bg-accent-soft text-ink' : 'border-white/5 bg-surface text-muted'
              }`}
            >
              <span>{t.emoji}</span> {t.title}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Title</Label>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setTemplate(null)
          }}
          placeholder="e.g. Read 10 pages"
          className="w-full rounded-2xl border border-white/10 bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      <div>
        <Label>Icon</Label>
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
        <Label>Type</Label>
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
            <Label>Target / session</Label>
            <input
              type="number"
              min="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-surface px-4 py-3 text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <Label>Unit</Label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="min, pages…"
              className="w-full rounded-2xl border border-white/10 bg-surface px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>
      )}

      {/* ── Which days? Off-days never look like misses ─────────────────── */}
      <div>
        <Label>Days</Label>
        <div className="flex justify-between gap-1.5">
          {WEEKDAY_ORDER.map((d) => {
            const on = days.includes(d)
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                aria-pressed={on}
                className={`h-10 w-10 rounded-full text-sm font-bold transition-colors ${
                  on ? 'bg-accent text-base' : 'bg-surface text-muted'
                }`}
                style={on ? { color: 'rgb(var(--c-base))' } : undefined}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {days.length === 7 ? 'Every day' : days.length === 0 ? 'Pick at least one day' : 'Rest days pause the climb — they never break it'}
        </p>
      </div>

      {/* ── Habit stacking: chain it after something you already do ─────── */}
      {habits.length > 0 && (
        <div>
          <Label>Stack after (optional)</Label>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            <button
              onClick={() => setAnchorId(null)}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                anchorId === null ? 'border-accent bg-accent-soft text-ink' : 'border-white/5 bg-surface text-muted'
              }`}
            >
              None
            </button>
            {habits.map((h) => (
              <button
                key={h.id}
                onClick={() => setAnchorId(h.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  anchorId === h.id ? 'border-accent bg-accent-soft text-ink' : 'border-white/5 bg-surface text-muted'
                }`}
              >
                <span>{h.emoji}</span> {h.title.length > 18 ? h.title.slice(0, 18) + '…' : h.title}
              </button>
            ))}
          </div>
          {anchorId && (
            <p className="mt-1.5 text-xs text-muted">
              After you log the anchor, the app glides here so the chain keeps moving.
            </p>
          )}
        </div>
      )}

      {/* ── Reminder ────────────────────────────────────────────────────── */}
      <div>
        <Label>Reminder (optional)</Label>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className="rounded-2xl border border-white/10 bg-surface px-4 py-3 text-ink outline-none focus:border-accent"
          />
          {reminderTime && (
            <button onClick={() => setReminderTime('')} className="text-xs font-medium text-muted underline">
              clear
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Fires only on the days above. Needs notifications set up once in Settings.
        </p>
      </div>

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
