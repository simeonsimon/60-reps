// Quick-start templates: two taps from "I want a new habit" to climbing.
// days use JS weekday numbers (0 = Sunday); omit for every day.
// reminder is a suggested time — saved with the habit, enabled by default so
// the new habit actually shows up in your day (it can be toggled off).

export const TEMPLATES = [
  {
    id: 'gym',
    title: 'Gym session',
    emoji: '💪',
    type: 'single',
    days: [1, 3, 5],
    reminder: '17:30',
  },
  {
    id: 'study',
    title: 'Deep study block',
    emoji: '📚',
    type: 'progress',
    target: 45,
    unit: 'min',
    reminder: '16:00',
  },
  {
    id: 'chem-paper',
    title: 'Chemistry past paper',
    emoji: '🧪',
    type: 'single',
    days: [2, 6],
  },
  {
    id: 'phys-paper',
    title: 'Physics past paper',
    emoji: '⚡',
    type: 'single',
    days: [4, 0],
  },
  {
    id: 'anki',
    title: 'Clear Anki reviews',
    emoji: '🃏',
    type: 'single',
    reminder: '14:30',
  },
  {
    id: 'read',
    title: 'Read 10 pages',
    emoji: '📖',
    type: 'single',
    reminder: '22:00',
  },
  {
    id: 'free-throws',
    title: 'Free throws',
    emoji: '🏀',
    type: 'progress',
    target: 50,
    unit: 'throws',
    days: [2, 4, 6],
  },
  {
    id: 'run',
    title: 'Go for a run',
    emoji: '🏃',
    type: 'single',
    days: [2, 4, 6],
    reminder: '08:30',
  },
  {
    id: 'water',
    title: 'Drink water',
    emoji: '💧',
    type: 'multi',
  },
  {
    id: 'sleep',
    title: 'In bed by 23:00',
    emoji: '🛏️',
    type: 'single',
    reminder: '22:30',
  },
  {
    id: 'stretch',
    title: 'Stretch 10 min',
    emoji: '🧘',
    type: 'progress',
    target: 10,
    unit: 'min',
  },
  {
    id: 'journal',
    title: 'Journal one page',
    emoji: '✍️',
    type: 'single',
    reminder: '21:30',
  },
]
