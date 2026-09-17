import { useMemo } from 'react'
import { dayCompletion } from '../../lib/analytics.js'
import { startOfDay } from '../../lib/habits.js'

const RADIUS = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function recentDays(now) {
  const today = new Date(startOfDay(now))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return date.getTime()
  })
}

export default function DayStrip({ habits }) {
  const today = startOfDay(Date.now())
  const days = useMemo(
    () => recentDays(today).map((day) => ({ day, completion: dayCompletion(habits, day, today) })),
    [habits, today],
  )

  return (
    <section aria-label="Last seven days" className="rounded-3xl border border-line/10 bg-surface/65 px-2 py-3">
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ day, completion }) => {
          const date = new Date(day)
          const isToday = day === today
          const label = date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1)
          const detail = completion.scheduled
            ? `${completion.hit} of ${completion.scheduled} scheduled habits completed`
            : 'No habits scheduled'
          return (
            <div
              key={day}
              className="flex min-w-0 flex-col items-center gap-1"
              aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${detail}`}
              aria-current={isToday ? 'date' : undefined}
            >
              <span className={`text-2xs font-bold uppercase ${isToday ? 'text-accent' : 'text-muted'}`}>{label}</span>
              <span className="relative grid h-9 w-9 place-items-center">
                <svg aria-hidden="true" viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="rgb(var(--c-line))" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r={RADIUS}
                    fill="none"
                    stroke="rgb(var(--c-accent))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - completion.pct)}
                  />
                </svg>
                <span className={`relative text-xs font-bold ${isToday ? 'text-ink' : 'text-muted'}`}>{date.getDate()}</span>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
