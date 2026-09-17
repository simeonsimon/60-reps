import { MIN_N } from '../../lib/analytics/metrics.js'

export function unlockRequirement(unlock, data) {
  if (unlock.id === 'forecast') {
    const needsReps = unlock.have < unlock.want
    const needsDays = data && data.ageDays < MIN_N.forecast.alsoDays
    if (needsReps && needsDays) return `needs ${unlock.want} reps and ${MIN_N.forecast.alsoDays} days of history`
    if (needsDays) return `needs ${MIN_N.forecast.alsoDays} days of history`
    return `needs ${unlock.want} reps`
  }
  if (unlock.id === 'momentum') return `needs ${unlock.want} reps in a comparison week`
  if (unlock.id === 'hitRate28') return `needs ${unlock.want} scheduled days`
  if (unlock.id === 'timeOfDay') return `needs ${unlock.want} reps`
  if (unlock.id === 'weekdayPattern') return `needs ${unlock.want} days of history`
  if (unlock.id === 'baseline28') return `needs ${unlock.want} days of history`
  if (unlock.id === 'monthOverMonth') return `needs ${unlock.want} calendar months`
  return `needs ${unlock.want} samples`
}

export function unlockTiming(unlock) {
  if (unlock.ready) return 'ready'
  if (unlock.etaDays === null) return 'timing depends on your schedule'
  if (unlock.etaDays === 0) return 'can unlock today'
  return `about ${unlock.etaDays} day${unlock.etaDays === 1 ? '' : 's'} away`
}

export function LockedStrip({ unlock, data, className = '' }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border border-dashed border-line/10 bg-elevated/60 px-3 py-2.5 text-xs leading-relaxed text-muted ${className}`}
    >
      <span aria-hidden="true" className="shrink-0">
        🔒
      </span>
      <p>
        <span className="font-semibold text-ink">{unlock.label}</span>
        {' · '}
        {unlockRequirement(unlock, data)}
        {' · '}
        {unlockTiming(unlock)}
      </p>
    </div>
  )
}

export default function ReadinessCard({ data }) {
  const readyCount = data.unlocks.filter((unlock) => unlock.ready).length
  if (readyCount * 2 >= data.unlocks.length) return null

  const nearest = data.unlocks
    .filter((unlock) => !unlock.ready)
    .sort((a, b) => (a.etaDays ?? Infinity) - (b.etaDays ?? Infinity))
    .slice(0, 2)

  return (
    <section className="rounded-3xl border border-line/5 bg-surface p-4" aria-label="Analysis readiness">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-ink">Analysis readiness</h4>
        <span className="text-xs2 text-muted">
          {readyCount}/{data.unlocks.length} reads ready
        </span>
      </div>
      <div className="space-y-2">
        {nearest.map((unlock) => (
          <LockedStrip key={unlock.id} unlock={unlock} data={data} />
        ))}
      </div>
    </section>
  )
}
