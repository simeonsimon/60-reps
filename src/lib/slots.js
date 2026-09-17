import { dayParts } from './analytics.js'

export const SLOTS = [
  { id: 'morning', label: 'Morning', hint: 'before noon' },
  { id: 'day', label: 'Day', hint: 'noon - 5pm' },
  { id: 'evening', label: 'Evening', hint: 'after 5pm' },
  { id: 'anytime', label: 'Anytime', hint: 'no fixed slot' },
]

const SLOT_IDS = new Set(SLOTS.map((slot) => slot.id))
const HISTORY_SLOT = {
  morning: 'morning',
  afternoon: 'day',
  evening: 'evening',
  night: 'evening',
}

// Resolve only from evidence the person supplied or the habit established.
// Sparse history falls through to Anytime rather than fabricating a routine.
export function resolveSlot(habit) {
  if (SLOT_IDS.has(habit.slot)) return habit.slot

  const reminderTime = habit.reminder?.time
  const reminderHour = typeof reminderTime === 'string' ? Number.parseInt(reminderTime.split(':')[0], 10) : Number.NaN
  if (Number.isInteger(reminderHour) && reminderHour >= 0 && reminderHour < 24) {
    if (reminderHour < 12) return 'morning'
    if (reminderHour < 17) return 'day'
    return 'evening'
  }

  const parts = dayParts(habit)
  if (parts.total >= 8 && parts.top) return HISTORY_SLOT[parts.top.id] || 'anytime'

  return 'anytime'
}

// This only suggests a picker value. Callers decide whether to persist it.
export function suggestSlotFromTitle(title) {
  const normalized = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (/\b(morning|manana)\b/.test(normalized)) return 'morning'
  if (/\b(afternoon|tarde)\b/.test(normalized)) return 'day'
  if (/\b(night|noche|sleep|dormir|bed(?:time)?)\b/.test(normalized)) return 'evening'
  return 'anytime'
}

export function groupBySlot(habits) {
  const groups = new Map(SLOTS.map((slot) => [slot.id, []]))
  for (const habit of habits) groups.get(resolveSlot(habit)).push(habit)

  return SLOTS.map((slot) => ({ ...slot, habits: groups.get(slot.id) })).filter((group) => group.habits.length > 0)
}
